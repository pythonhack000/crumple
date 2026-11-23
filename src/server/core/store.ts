import { redis } from '@devvit/web/server';
import type { DayStatus, LeaderRow, Question } from '../../shared/api';

/** A stored round. One per UTC day. */
export type Round = {
  dayKey: string;
  dayNumber: number;
  question: Question;
  postId: string;
  status: DayStatus;
};

export type Vote = {
  pick: number;
  call: number;
};

export type PlayerRecord = {
  streak: number;
  bestStreak: number;
  lastDay: string | undefined;
  total: number;
  played: number;
  calledRight: number;
};

const key = {
  current: 'current',
  dayCount: 'day-count',
  leaders: 'leaders',
  queue: 'queue',
  round: (dayKey: string) => `round:${dayKey}`,
  postRound: (postId: string) => `post:${postId}`,
  votes: (dayKey: string) => `votes:${dayKey}`,
  tally: (dayKey: string) => `tally:${dayKey}`,
  points: (dayKey: string) => `points:${dayKey}`,
  player: (username: string) => `player:${username}`,
};

const toInt = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseQuestion(raw: string | undefined): Question | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'prompt' in value &&
      'options' in value &&
      typeof value.prompt === 'string' &&
      Array.isArray(value.options) &&
      value.options.every((option: unknown) => typeof option === 'string')
    ) {
      return { prompt: value.prompt, options: value.options };
    }
  } catch (error) {
    console.error('Stored question is not valid JSON', error);
  }
  return undefined;
}

function parseVote(raw: string | undefined): Vote | undefined {
  if (!raw) return undefined;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      typeof value === 'object' &&
      value !== null &&
      'pick' in value &&
      'call' in value &&
      typeof value.pick === 'number' &&
      typeof value.call === 'number'
    ) {
      return { pick: value.pick, call: value.call };
    }
  } catch (error) {
    console.error('Stored vote is not valid JSON', error);
  }
  return undefined;
}

// Rounds

export async function getRound(dayKey: string): Promise<Round | undefined> {
  const fields = await redis.hGetAll(key.round(dayKey));
  const question = parseQuestion(fields.question);
  if (!question || !fields.postId) return undefined;
  return {
    dayKey,
    dayNumber: toInt(fields.dayNumber),
    question,
    postId: fields.postId,
    status: fields.status === 'closed' ? 'closed' : 'open',
  };
}

export async function getRoundForPost(postId: string): Promise<Round | undefined> {
  const dayKey = await redis.get(key.postRound(postId));
  return dayKey ? getRound(dayKey) : undefined;
}

export async function getCurrentDayKey(): Promise<string | undefined> {
  return redis.get(key.current);
}

export async function nextDayNumber(): Promise<number> {
  return redis.incrBy(key.dayCount, 1);
}

export async function saveRound(round: Round): Promise<void> {
  await redis.hSet(key.round(round.dayKey), {
    dayNumber: String(round.dayNumber),
    question: JSON.stringify(round.question),
    postId: round.postId,
    status: round.status,
  });
  await redis.set(key.postRound(round.postId), round.dayKey);
  if (round.status === 'open') await redis.set(key.current, round.dayKey);
}

export async function markClosed(dayKey: string): Promise<void> {
  await redis.hSet(key.round(dayKey), { status: 'closed' });
}

// Votes

export async function getVote(dayKey: string, username: string): Promise<Vote | undefined> {
  return parseVote(await redis.hGet(key.votes(dayKey), username));
}

/** Stores a vote once; returns false when the player already voted. */
export async function addVote(dayKey: string, username: string, vote: Vote): Promise<boolean> {
  const added = await redis.hSetNX(key.votes(dayKey), username, JSON.stringify(vote));
  if (added === 0) return false;
  await redis.hIncrBy(key.tally(dayKey), String(vote.pick), 1);
  return true;
}

export async function getAllVotes(dayKey: string): Promise<Map<string, Vote>> {
  const raw = await redis.hGetAll(key.votes(dayKey));
  const votes = new Map<string, Vote>();
  for (const [username, value] of Object.entries(raw)) {
    const vote = parseVote(value);
    if (vote) votes.set(username, vote);
  }
  return votes;
}

export async function getTally(dayKey: string, optionCount: number): Promise<number[]> {
  const raw = await redis.hGetAll(key.tally(dayKey));
  return Array.from({ length: optionCount }, (_, index) => toInt(raw[String(index)]));
}

export async function countPlayers(dayKey: string): Promise<number> {
  return redis.hLen(key.votes(dayKey));
}

// Points

export async function savePoints(dayKey: string, points: Map<string, number>): Promise<void> {
  if (points.size === 0) return;
  await redis.hSet(
    key.points(dayKey),
    Object.fromEntries([...points].map(([username, value]) => [username, String(value)]))
  );
}

export async function getPoints(dayKey: string, username: string): Promise<number | null> {
  const value = await redis.hGet(key.points(dayKey), username);
  return value === undefined ? null : toInt(value);
}

// Players

export async function getPlayer(username: string): Promise<PlayerRecord> {
  const fields = await redis.hGetAll(key.player(username));
  return {
    streak: toInt(fields.streak),
    bestStreak: toInt(fields.bestStreak),
    lastDay: fields.lastDay,
    total: toInt(fields.total),
    played: toInt(fields.played),
    calledRight: toInt(fields.calledRight),
  };
}

export async function savePlayer(username: string, player: PlayerRecord): Promise<void> {
  await redis.hSet(key.player(username), {
    streak: String(player.streak),
    bestStreak: String(player.bestStreak),
    lastDay: player.lastDay ?? '',
    total: String(player.total),
    played: String(player.played),
    calledRight: String(player.calledRight),
  });
}

export async function addScore(username: string, points: number, calledRight: boolean): Promise<void> {
  await redis.hIncrBy(key.player(username), 'total', points);
  if (calledRight) await redis.hIncrBy(key.player(username), 'calledRight', 1);
  await redis.zIncrBy(key.leaders, username, points);
}

export async function getRank(username: string): Promise<number | null> {
  const [rank, size] = await Promise.all([redis.zRank(key.leaders, username), redis.zCard(key.leaders)]);
  return rank === undefined ? null : size - rank;
}

export async function getLeaders(count: number): Promise<LeaderRow[]> {
  const rows = await redis.zRange(key.leaders, 0, count - 1, { by: 'rank', reverse: true });
  return rows.map((row) => ({ username: row.member, score: row.score }));
}

// Moderator question queue

export async function queueQuestion(question: Question): Promise<number> {
  await redis.zAdd(key.queue, { member: JSON.stringify(question), score: Date.now() });
  return redis.zCard(key.queue);
}

/** Takes the oldest queued question, if any. */
export async function takeQueuedQuestion(): Promise<Question | undefined> {
  const [first] = await redis.zRange(key.queue, 0, 0, { by: 'rank' });
  if (!first) return undefined;
  await redis.zRem(key.queue, [first.member]);
  return parseQuestion(first.member);
}
