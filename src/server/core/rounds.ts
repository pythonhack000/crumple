import { reddit } from '@devvit/web/server';
import type { MyRound, PlayerStats, RoundView, ShotRequest } from '../../shared/api';
import { dayKeyOf, daysBetween, nextStreak } from '../../shared/game';
import { cleanTableBonus, shotScore } from '../../shared/level';
import type { Level } from '../../shared/level';
import { TWIST_LABELS } from '../../shared/share';
import { TWISTS } from '../../shared/level';
import { findSolution } from '../../shared/sim';
import { builtInLevelFor } from '../../shared/levels';
import * as store from './store';
import type { Round } from './store';

export const GAME_NAME = 'Crumple';
const RESULTS_TOP = 3;
/** A player cannot report more shots than this per round. */
export const MAX_ATTEMPTS = 500;

/** Midnight UTC after the given day: when that day's round closes. */
export function closesAt(dayKey: string): string {
  const next = new Date(`${dayKey}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString();
}

export async function buildRoundView(round: Round): Promise<RoundView> {
  const [players, holesInOne] = await Promise.all([store.countPlayers(round.dayKey), store.countHolesInOne(round.dayKey)]);
  return {
    dayKey: round.dayKey,
    dayNumber: round.dayNumber,
    level: round.level,
    status: round.status,
    closesAt: closesAt(round.dayKey),
    players,
    holesInOne,
  };
}

export async function getStats(username: string): Promise<PlayerStats> {
  const [player, rank] = await Promise.all([store.getPlayer(username), store.getRank(username)]);
  // A streak is still alive if the player played today or yesterday.
  const isAlive = player.lastDay ? daysBetween(player.lastDay, dayKeyOf(new Date())) <= 1 : false;
  return {
    username,
    streak: isAlive ? player.streak : 0,
    bestStreak: player.bestStreak,
    total: player.total,
    rank,
  };
}

export class ShotError extends Error {}

async function updateStreak(username: string, dayKey: string): Promise<number> {
  const player = await store.getPlayer(username);
  const streak = nextStreak(player.lastDay, player.streak, dayKey);
  if (player.lastDay !== dayKey) {
    await store.savePlayerStreak(username, {
      ...player,
      streak,
      bestStreak: Math.max(player.bestStreak, streak),
      lastDay: dayKey,
    });
  }
  return streak;
}

async function updateFlair(username: string, streak: number): Promise<void> {
  try {
    const subredditName = (await reddit.getCurrentSubreddit()).name;
    await reddit.setUserFlair({
      subredditName,
      username,
      text: `${GAME_NAME}: ${streak} ${streak === 1 ? 'day' : 'days'} in a row`,
    });
  } catch (error) {
    // Flair is a bonus; a subreddit without user flair must not break the game.
    console.error(`Could not set flair for ${username}`, error);
  }
}

/**
 * Records one shot. Attempts are counted here, not trusted from the client.
 * Shots after the first sink are practice and change nothing.
 */
export async function recordShot(round: Round, username: string, shot: ShotRequest): Promise<{ mine: MyRound; counted: boolean }> {
  if (round.status !== 'open') throw new ShotError('This round is closed. Today’s level is up.');
  const before = await store.getMyRound(round.dayKey, username);
  if (before.sunk) return { mine: before, counted: false };
  if (before.attempts >= MAX_ATTEMPTS) throw new ShotError('That is enough shots for today.');

  const attempt = await store.addAttempt(round.dayKey, username);
  if (attempt === 1) {
    const streak = await updateStreak(username, round.dayKey);
    await updateFlair(username, streak);
  }
  if (!shot.sunk && shot.rest) await store.addToPile(round.dayKey, username, shot.rest);
  if (shot.sunk) {
    const pile = await store.pileSize(round.dayKey);
    const result = { attempt, stars: shot.stars, score: shotScore(attempt, shot.stars, pile), bonus: cleanTableBonus(pile) };
    if (await store.recordSink(round.dayKey, username, result, shot.path)) {
      await store.addToTotal(username, result.score);
      // Credit only real, other people's balls that are on today's table.
      const onTable = await store.pileOwners(round.dayKey);
      for (const owner of shot.owners) {
        if (owner !== username && onTable.has(owner)) await store.addAssist(round.dayKey, owner);
      }
    }
  }
  return { mine: await store.getMyRound(round.dayKey, username), counted: true };
}

async function setLevelMakerFlair(username: string): Promise<void> {
  try {
    const subredditName = (await reddit.getCurrentSubreddit()).name;
    await reddit.setUserFlair({ subredditName, username, text: `${GAME_NAME} level maker` });
  } catch (error) {
    console.error(`Could not set level maker flair for ${username}`, error);
  }
}

async function resultsComment(round: Round): Promise<string> {
  const [view, top, helper] = await Promise.all([
    buildRoundView(round),
    store.getDayLeaders(round.dayKey, RESULTS_TOP),
    store.topAssist(round.dayKey),
  ]);
  const podium = top.map((row, index) => `${index + 1}. u/${row.username}: ${row.score}`);
  const helperLine = helper
    ? [`Most helpful miss: u/${helper.username}, whose balls helped ${helper.count} ${helper.count === 1 ? 'person' : 'people'} in.`, '']
    : [];
  return [
    `**${GAME_NAME} #${round.dayNumber}: ${round.level.name}, final results**`,
    '',
    `${view.players} ${view.players === 1 ? 'player' : 'players'}, ${view.holesInOne} ${view.holesInOne === 1 ? 'hole in one' : 'holes in one'}.`,
    '',
    ...(podium.length > 0 ? podium : ['Nobody got it in the bin']),
    '',
    ...helperLine,
    'Today’s level is up now.',
  ].join('\n');
}

/** Closes a round and pins its results under the post. */
export async function closeRound(round: Round): Promise<void> {
  if (round.status === 'closed') return;
  await store.markClosed(round.dayKey);
  try {
    const comment = await reddit.submitComment({
      id: round.postId as `t3_${string}`,
      text: await resultsComment(round),
      runAs: 'APP',
    });
    await comment.distinguish(true);
  } catch (error) {
    console.error(`Could not post results for round ${round.dayKey}`, error);
  }
}


const TWIST_EVERY = 7;

/** Every seventh day gets a twist, if the level can still be beaten with it. */
function withTwist(level: Level, dayNumber: number): Level {
  if (level.twist || dayNumber % TWIST_EVERY !== 0) return level;
  const twist = TWISTS[Math.floor(dayNumber / TWIST_EVERY) % TWISTS.length];
  if (!twist) return level;
  const twisted = { ...level, twist };
  return findSolution(twisted) ? twisted : level;
}

function roundTitle(dayNumber: number, level: Level): string {
  const byline = level.author ? ` by u/${level.author}` : '';
  const twist = level.twist ? `${TWIST_LABELS[level.twist].name}, ` : '';
  return `${GAME_NAME} #${dayNumber}: ${twist}${level.name}${byline}`;
}

/**
 * Posts today's open round again under a fresh post. Shots, the shared table
 * and the board belong to the round, so nothing is lost; both posts work.
 */
export async function repostToday(): Promise<Round | undefined> {
  const currentKey = await store.getCurrentDayKey();
  const round = currentKey ? await store.getRound(currentKey) : undefined;
  if (!round || round.status !== 'open') return undefined;
  const post = await reddit.submitCustomPost({ title: roundTitle(round.dayNumber, round.level), entry: 'default' });
  const next = { ...round, postId: post.id };
  await store.saveRound(next);
  return next;
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
  const community = await store.takeTopCommunityLevel();
  const level = withTwist(community ? { ...community.level, author: community.author } : builtInLevelFor(dayNumber), dayNumber);
  if (community) await setLevelMakerFlair(community.author);
  const post = await reddit.submitCustomPost({ title: roundTitle(dayNumber, level), entry: 'default' });
  const round: Round = { dayKey: today, dayNumber, level, postId: post.id, status: 'open' };
  await store.saveRound(round);
  return round;
}
