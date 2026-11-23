import { redis } from '@devvit/web/server';
import type { LeaderRow, MyRound, PileBall, RoundStatus } from '../../shared/api';
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
  ballArt: 'ball-art',
  round: (day: string) => `round:${day}`,
  postRound: (postId: string) => `post:${postId}`,
  attempts: (day: string) => `attempts:${day}`,
  sunk: (day: string) => `sunk:${day}`,
  board: (day: string) => `board:${day}`,
  ghosts: (day: string) => `ghosts:${day}`,
  holesInOne: (day: string) => `hio:${day}`,
  pile: (day: string) => `pile:${day}`,
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

type SinkRecord = { attempt: number; stars: number; score: number; bonus?: number };

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
    // Sinks recorded before the clean table bonus existed have no bonus field.
    sunk: isSinkRecord(sunk)
      ? { attempt: sunk.attempt, stars: sunk.stars, score: sunk.score, bonus: typeof sunk.bonus === 'number' ? sunk.bonus : 0 }
      : null,
  };
}

/** Counts one more shot and returns the new attempt number. */
export async function addAttempt(dayKey: string, username: string): Promise<number> {
  return redis.hIncrBy(key.attempts(dayKey), username, 1);
}

/** Shared table: the newest missed balls from every player today. */
export const PILE_SIZE = 80;

/** Drops a missed ball on today's shared table, keeping only the newest. */
export async function addToPile(dayKey: string, username: string, point: Point): Promise<void> {
  const member = `${point.x},${point.y},${username},${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  await redis.zAdd(key.pile(dayKey), { member, score: Date.now() });
  await redis.zRemRangeByRank(key.pile(dayKey), 0, -(PILE_SIZE + 1));
}

export async function pileSize(dayKey: string): Promise<number> {
  return redis.zCard(key.pile(dayKey));
}

export async function getPile(dayKey: string, username: string | undefined): Promise<PileBall[]> {
  const rows = await redis.zRange(key.pile(dayKey), 0, -1, { by: 'rank' });
  return rows.flatMap((row) => {
    const [x, y, owner] = row.member.split(',');
    const px = Number(x);
    const py = Number(y);
    return Number.isFinite(px) && Number.isFinite(py) && owner ? [{ x: px, y: py, mine: owner === username, owner }] : [];
  });
}

/** Records the first sink; returns false if the player already sank this round. */
export async function recordSink(
  dayKey: string,
  username: string,
  sunk: SinkRecord,
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

// Player-made levels, voted on by the community

const levelKey = {
  seq: 'cl:seq',
  board: 'cl:board',
  level: (id: string) => `cl:${id}`,
  votes: (id: string) => `cl:votes:${id}`,
  submittedToday: (day: string) => `cl:daily:${day}`,
};

export type StoredLevel = { id: string; level: Level; author: string; votes: number };

export async function countSubmissionsToday(dayKey: string, username: string): Promise<number> {
  return toInt(await redis.hGet(levelKey.submittedToday(dayKey), username));
}

export async function addCommunityLevel(dayKey: string, username: string, level: Level): Promise<string> {
  const id = String(await redis.incrBy(levelKey.seq, 1));
  await redis.hSet(levelKey.level(id), { level: JSON.stringify(level), author: username, created: String(Date.now()) });
  await redis.zAdd(levelKey.board, { member: id, score: 0 });
  await redis.hIncrBy(levelKey.submittedToday(dayKey), username, 1);
  return id;
}

async function getCommunityLevel(id: string, votes: number): Promise<StoredLevel | undefined> {
  const fields = await redis.hGetAll(levelKey.level(id));
  const level = parseLevel(parseJson(fields.level));
  return level && fields.author ? { id, level, author: fields.author, votes } : undefined;
}

/** Pending levels, most upvoted first. */
export async function listCommunityLevels(count: number): Promise<StoredLevel[]> {
  const rows = await redis.zRange(levelKey.board, 0, count - 1, { by: 'rank', reverse: true });
  const levels = await Promise.all(rows.map((row) => getCommunityLevel(row.member, row.score)));
  return levels.filter((level): level is StoredLevel => level !== undefined);
}

export async function hasVoted(id: string, username: string): Promise<boolean> {
  return (await redis.hGet(levelKey.votes(id), username)) !== undefined;
}

export async function levelAuthor(id: string): Promise<string | undefined> {
  return (await redis.hGet(levelKey.level(id), 'author')) ?? undefined;
}

/** Adds one upvote; returns the new total, or undefined if already voted. */
export async function voteForLevel(id: string, username: string): Promise<number | undefined> {
  const added = await redis.hSetNX(levelKey.votes(id), username, '1');
  if (added === 0) return undefined;
  return redis.zIncrBy(levelKey.board, id, 1);
}

/** Takes the most upvoted pending level (with at least one vote) off the board. */
export async function takeTopCommunityLevel(): Promise<StoredLevel | undefined> {
  const [top] = await redis.zRange(levelKey.board, 0, 0, { by: 'rank', reverse: true });
  if (!top || top.score < 1) return undefined;
  await redis.zRem(levelKey.board, [top.member]);
  return getCommunityLevel(top.member, top.score);
}

// Player-drawn balls

const MAX_ARTS_PER_RESPONSE = 40;

export async function setBallArt(username: string, art: string | null): Promise<void> {
  if (art === null) await redis.hDel(key.ballArt, [username]);
  else await redis.hSet(key.ballArt, { [username]: art });
}

/** Drawn balls for these players (the most recent pile owners first). */
export async function getBallArts(usernames: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(usernames)].slice(0, MAX_ARTS_PER_RESPONSE);
  if (unique.length === 0) return {};
  const values = await redis.hMGet(key.ballArt, unique);
  return Object.fromEntries(
    unique.flatMap((name, index) => {
      const art = values[index];
      return art ? [[name, art]] : [];
    })
  );
}
