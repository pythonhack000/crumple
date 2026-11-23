import { redis } from '@devvit/web/server';
import type { LeaderRow, MyRound, RoundStatus } from '../../shared/api';
import type { Level, Point } from '../../shared/level';
import { parseLevel } from '../../shared/level';

/** A stored round. One per UTC day. */
export type Round = {
  dayKey: string;
  dayNumber: number;
  level: Level;
  postId: string;
  status: RoundStatus;
};

export type PlayerRecord = {
  streak: number;
  bestStreak: number;
  lastDay: string | undefined;
  total: number;
};

/** Sinking paths kept per round for the ghost overlay. */
export const MAX_GHOSTS = 60;

const key = {
  current: 'current',
  dayCount: 'day-count',
  leaders: 'leaders',
  levelQueue: 'level-queue',
  round: (day: string) => `round:${day}`,
  postRound: (postId: string) => `post:${postId}`,
  attempts: (day: string) => `attempts:${day}`,
  sunk: (day: string) => `sunk:${day}`,
  board: (day: string) => `board:${day}`,
  ghosts: (day: string) => `ghosts:${day}`,
  holesInOne: (day: string) => `hio:${day}`,
  player: (username: string) => `player:${username}`,
};

const toInt = (value: string | undefined): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseJson(raw: string | undefined): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error('Stored value is not valid JSON', error);
    return undefined;
  }
}

function parsePath(raw: string | undefined): Point[] | undefined {
  const value = parseJson(raw);
  if (!Array.isArray(value)) return undefined;
  return value.filter(
    (point): point is Point =>
      typeof point === 'object' && point !== null && typeof point.x === 'number' && typeof point.y === 'number'
  );
}

// Rounds

export async function getRound(dayKey: string): Promise<Round | undefined> {
  const fields = await redis.hGetAll(key.round(dayKey));
  const level = parseLevel(parseJson(fields.level));
  if (!level || !fields.postId) return undefined;
  return {
    dayKey,
    dayNumber: toInt(fields.dayNumber),
    level,
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
    level: JSON.stringify(round.level),
    postId: round.postId,
    status: round.status,
  });
  await redis.set(key.postRound(round.postId), round.dayKey);
  if (round.status === 'open') await redis.set(key.current, round.dayKey);
}

export async function markClosed(dayKey: string): Promise<void> {
  await redis.hSet(key.round(dayKey), { status: 'closed' });
}

// Shots

type SinkRecord = { attempt: number; stars: number; score: number };

function isSinkRecord(value: unknown): value is SinkRecord {
  if (typeof value !== 'object' || value === null) return false;
  const { attempt, stars, score } = value as Record<string, unknown>;
  return typeof attempt === 'number' && typeof stars === 'number' && typeof score === 'number';
}

export async function getMyRound(dayKey: string, username: string): Promise<MyRound> {
  const [attempts, sunkRaw] = await Promise.all([
    redis.hGet(key.attempts(dayKey), username),
    redis.hGet(key.sunk(dayKey), username),
  ]);
  const sunk = parseJson(sunkRaw);
  return {
    attempts: toInt(attempts),
    sunk: isSinkRecord(sunk) ? { attempt: sunk.attempt, stars: sunk.stars, score: sunk.score } : null,
  };
}

/** Counts one more shot and returns the new attempt number. */
export async function addAttempt(dayKey: string, username: string): Promise<number> {
  return redis.hIncrBy(key.attempts(dayKey), username, 1);
}

/** Records the first sink; returns false if the player already sank this round. */
export async function recordSink(
  dayKey: string,
  username: string,
  sunk: { attempt: number; stars: number; score: number },
  path: Point[]
): Promise<boolean> {
  const added = await redis.hSetNX(key.sunk(dayKey), username, JSON.stringify(sunk));
  if (added === 0) return false;
  await redis.zAdd(key.board(dayKey), { member: username, score: sunk.score });
  if (sunk.attempt === 1) await redis.incrBy(key.holesInOne(dayKey), 1);
  if ((await redis.hLen(key.ghosts(dayKey))) < MAX_GHOSTS) {
    await redis.hSet(key.ghosts(dayKey), { [username]: JSON.stringify(path) });
  }
  return true;
}

export async function countPlayers(dayKey: string): Promise<number> {
  return redis.hLen(key.attempts(dayKey));
}

export async function countHolesInOne(dayKey: string): Promise<number> {
  return toInt(await redis.get(key.holesInOne(dayKey)));
}

export async function getGhosts(dayKey: string, exceptUsername: string | undefined): Promise<Point[][]> {
  const raw = await redis.hGetAll(key.ghosts(dayKey));
  return Object.entries(raw)
    .filter(([username]) => username !== exceptUsername)
    .map(([, value]) => parsePath(value))
    .filter((path): path is Point[] => path !== undefined && path.length > 1);
}

export async function getDayLeaders(dayKey: string, count: number): Promise<LeaderRow[]> {
  const rows = await redis.zRange(key.board(dayKey), 0, count - 1, { by: 'rank', reverse: true });
  return rows.map((row) => ({ username: row.member, score: row.score }));
}

// Players

export async function getPlayer(username: string): Promise<PlayerRecord> {
  const fields = await redis.hGetAll(key.player(username));
  return {
    streak: toInt(fields.streak),
    bestStreak: toInt(fields.bestStreak),
    lastDay: fields.lastDay || undefined,
    total: toInt(fields.total),
  };
}

export async function savePlayerStreak(username: string, player: PlayerRecord): Promise<void> {
  await redis.hSet(key.player(username), {
    streak: String(player.streak),
    bestStreak: String(player.bestStreak),
    lastDay: player.lastDay ?? '',
  });
}

export async function addToTotal(username: string, points: number): Promise<void> {
  await redis.hIncrBy(key.player(username), 'total', points);
  await redis.zIncrBy(key.leaders, username, points);
}

export async function getRank(username: string): Promise<number | null> {
  const [rank, size] = await Promise.all([redis.zRank(key.leaders, username), redis.zCard(key.leaders)]);
  return rank === undefined ? null : size - rank;
}

// Player-made levels waiting to become a daily level

export async function queueLevel(level: Level): Promise<number> {
  await redis.zAdd(key.levelQueue, { member: JSON.stringify(level), score: Date.now() });
  return redis.zCard(key.levelQueue);
}

export async function takeQueuedLevel(): Promise<Level | undefined> {
  const [first] = await redis.zRange(key.levelQueue, 0, 0, { by: 'rank' });
  if (!first) return undefined;
  await redis.zRem(key.levelQueue, [first.member]);
  return parseLevel(parseJson(first.member));
}
