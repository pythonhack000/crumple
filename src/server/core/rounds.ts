import { reddit } from '@devvit/web/server';
import type { DayView, PlayerStats, Question, VoteRequest } from '../../shared/api';
import {
  CALL_POINTS,
  dayKeyOf,
  daysBetween,
  majorityOf,
  nextStreak,
  percentages,
  scoreCall,
} from '../../shared/game';
import { bankQuestionFor } from './questions';
import * as store from './store';
import type { Round } from './store';

export const GAME_NAME = 'Hunch';

/** Midnight UTC after the given day: when that day's round closes. */
export function closesAt(dayKey: string): string {
  const next = new Date(`${dayKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export async function buildDayView(round: Round, username: string | undefined): Promise<DayView> {
  const [players, vote, tally, points] = await Promise.all([
    store.countPlayers(round.dayKey),
    username ? store.getVote(round.dayKey, username) : Promise.resolve(undefined),
    round.status === 'closed'
      ? store.getTally(round.dayKey, round.question.options.length)
      : Promise.resolve(undefined),
    username && round.status === 'closed'
      ? store.getPoints(round.dayKey, username)
      : Promise.resolve(null),
  ]);

  return {
    dayKey: round.dayKey,
    dayNumber: round.dayNumber,
    question: round.question,
    status: round.status,
    players,
    closesAt: closesAt(round.dayKey),
    myPick: vote?.pick ?? null,
    myCall: vote?.call ?? null,
    result: tally ? { shares: percentages(tally), majority: majorityOf(tally), myPoints: points } : null,
  };
}

export async function getStats(username: string): Promise<PlayerStats> {
  const [player, rank] = await Promise.all([store.getPlayer(username), store.getRank(username)]);
  // A streak is still alive if the player played today or yesterday.
  const streakIsAlive = player.lastDay ? daysBetween(player.lastDay, dayKeyOf(new Date())) <= 1 : false;
  return {
    username,
    streak: streakIsAlive ? player.streak : 0,
    bestStreak: player.bestStreak,
    total: player.total,
    played: player.played,
    calledRight: player.calledRight,
    rank,
  };
}

export class VoteError extends Error {}

function isValidChoice(value: unknown, optionCount: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < optionCount;
}

/** Records a player's answer and their call on the crowd. */
export async function castVote(round: Round, username: string, request: VoteRequest): Promise<void> {
  if (round.status !== 'open') throw new VoteError('This round is closed. Come back for today’s question.');
  const optionCount = round.question.options.length;
  if (!isValidChoice(request.pick, optionCount) || !isValidChoice(request.call, optionCount)) {
    throw new VoteError('That answer is not one of the options.');
  }

  const added = await store.addVote(round.dayKey, username, { pick: request.pick, call: request.call });
  if (!added) throw new VoteError('You already played today.');

  const player = await store.getPlayer(username);
  const streak = nextStreak(player.lastDay || undefined, player.streak, round.dayKey);
  await store.savePlayer(username, {
    ...player,
    streak,
    bestStreak: Math.max(player.bestStreak, streak),
    lastDay: round.dayKey,
    played: player.played + 1,
  });
  await updateFlair(username, streak);
}

async function updateFlair(username: string, streak: number): Promise<void> {
  try {
    const subredditName = (await reddit.getCurrentSubreddit()).name;
    await reddit.setUserFlair({
      subredditName,
      username,
      text: `${GAME_NAME} streak: ${streak} ${streak === 1 ? 'day' : 'days'}`,
    });
  } catch (error) {
    // Flair is a bonus; a subreddit without user flair must not break the game.
    console.error(`Could not set flair for ${username}`, error);
  }
}

function resultsComment(round: Round, tally: number[], players: number): string {
  const shares = percentages(tally);
  const majority = majorityOf(tally);
  const lines = round.question.options.map((option, index) => {
    const marker = majority.includes(index) ? '**' : '';
    return `- ${marker}${option}: ${shares[index] ?? 0}%${marker}`;
  });
  const headline =
    players === 0
      ? 'Nobody played this one.'
      : `${players} ${players === 1 ? 'person' : 'people'} played. The crowd went with **${majority
          .map((index) => round.question.options[index])
          .join(' / ')}**.`;
  return [
    `**${GAME_NAME} #${round.dayNumber} results**`,
    '',
    headline,
    '',
    ...lines,
    '',
    `Called it? +${CALL_POINTS.majority}. Second place? +${CALL_POINTS.runnerUp}. Today’s question is up now.`,
  ].join('\n');
}

/** Closes a round, scores every call and posts the results under its post. */
export async function closeRound(round: Round): Promise<void> {
  if (round.status === 'closed') return;
  const tally = await store.getTally(round.dayKey, round.question.options.length);
  const votes = await store.getAllVotes(round.dayKey);

  const points = new Map<string, number>();
  for (const [username, vote] of votes) {
    const earned = scoreCall(vote.call, tally);
    points.set(username, earned);
    await store.addScore(username, earned, earned === CALL_POINTS.majority);
  }
  await store.savePoints(round.dayKey, points);
  await store.markClosed(round.dayKey);

  try {
    const comment = await reddit.submitComment({
      id: round.postId as `t3_${string}`,
      text: resultsComment(round, tally, votes.size),
      runAs: 'APP',
    });
    await comment.distinguish(true);
  } catch (error) {
    console.error(`Could not post results for round ${round.dayKey}`, error);
  }
}

async function questionFor(dayNumber: number): Promise<Question> {
  return (await store.takeQueuedQuestion()) ?? bankQuestionFor(dayNumber - 1);
}

/**
 * Closes the open round (if any) and opens today's. Safe to call twice on the
 * same day: the second call returns the round that is already open.
 */
export async function startDay(now: Date): Promise<Round> {
  const today = dayKeyOf(now);
  const existing = await store.getRound(today);
  if (existing) return existing;

  const currentKey = await store.getCurrentDayKey();
  if (currentKey) {
    const current = await store.getRound(currentKey);
    if (current) await closeRound(current);
  }

  const dayNumber = await store.nextDayNumber();
  const question = await questionFor(dayNumber);
  const post = await reddit.submitCustomPost({
    title: `${GAME_NAME} #${dayNumber}: ${question.prompt}`,
    entry: 'default',
  });
  const round: Round = { dayKey: today, dayNumber, question, postId: post.id, status: 'open' };
  await store.saveRound(round);
  return round;
}
