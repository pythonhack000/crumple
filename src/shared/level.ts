/** Logical playfield size. The game scales it to fit the post. */
export const WORLD = { width: 360, height: 600 } as const;

export const LIMITS = {
  walls: 14,
  bumpers: 6,
  portals: 2,
  fans: 3,
  stars: 3,
  nameLength: 32,
} as const;

export type Point = { x: number; y: number };
export type Wall = { x: number; y: number; w: number; h: number; angle: number };
export type Bumper = { x: number; y: number; r: number };
export type Portal = { a: Point; b: Point };
/** A zone that pushes the ball toward `angle` (degrees, 0 = right, -90 = up). */
export type Fan = { x: number; y: number; w: number; h: number; angle: number };

export type Level = {
  name: string;
  author: string | null;
  ball: Point;
  cup: Point;
  walls: Wall[];
  bumpers: Bumper[];
  portals: Portal[];
  fans: Fan[];
  stars: Point[];
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const num = (value: unknown, min: number, max: number): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? Math.round(value * 10) / 10
    : undefined;

function point(value: unknown): Point | undefined {
  if (!isObject(value)) return undefined;
  const x = num(value.x, 0, WORLD.width);
  const y = num(value.y, 0, WORLD.height);
  return x === undefined || y === undefined ? undefined : { x, y };
}

function list<T>(value: unknown, max: number, parse: (item: unknown) => T | undefined): T[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) return undefined;
  const parsed = value.map(parse);
  return parsed.every((item): item is T => item !== undefined) ? parsed : undefined;
}

function rect(value: unknown, minSize: number, maxSize: number): Wall | undefined {
  if (!isObject(value)) return undefined;
  const at = point(value);
  const w = num(value.w, minSize, maxSize);
  const h = num(value.h, minSize, maxSize);
  const angle = num(value.angle ?? 0, -180, 180);
  if (!at || w === undefined || h === undefined || angle === undefined) return undefined;
  return { ...at, w, h, angle };
}

function bumper(value: unknown): Bumper | undefined {
  if (!isObject(value)) return undefined;
  const at = point(value);
  const r = num(value.r, 8, 40);
  return at && r !== undefined ? { ...at, r } : undefined;
}

function portal(value: unknown): Portal | undefined {
  if (!isObject(value)) return undefined;
  const a = point(value.a);
  const b = point(value.b);
  return a && b ? { a, b } : undefined;
}

/** Validates untrusted level JSON (player-made levels, stored data). */
export function parseLevel(value: unknown): Level | undefined {
  if (!isObject(value)) return undefined;
  const name = typeof value.name === 'string' ? value.name.trim().slice(0, LIMITS.nameLength) : '';
  const author = typeof value.author === 'string' && value.author ? value.author.slice(0, 40) : null;
  const ball = point(value.ball);
  const cup = point(value.cup);
  const walls = list(value.walls, LIMITS.walls, (item) => rect(item, 6, 360));
  const bumpers = list(value.bumpers, LIMITS.bumpers, bumper);
  const portals = list(value.portals, LIMITS.portals, portal);
  const fans = list(value.fans, LIMITS.fans, (item) => rect(item, 20, 360));
  const stars = list(value.stars, LIMITS.stars, point);
  if (!name || !ball || !cup || !walls || !bumpers || !portals || !fans || !stars) return undefined;
  return { name, author, ball, cup, walls, bumpers, portals, fans, stars };
}

export const SCORE = {
  cup: 100,
  star: 25,
  attemptPenalty: 10,
  minCupScore: 30,
  /** Bonus for sinking while the shared table is still clean. */
  cleanTableMax: 50,
} as const;

/** Bonus for the clutter on the shared table when the ball went in. */
export function cleanTableBonus(pileSize: number): number {
  return Math.max(0, SCORE.cleanTableMax - pileSize);
}

/**
 * Score for sinking on attempt `attempt` (1-based) with `stars` collected,
 * while `pileSize` missed balls from everyone were on the table.
 */
export function shotScore(attempt: number, stars: number, pileSize: number = SCORE.cleanTableMax): number {
  const cup = Math.max(SCORE.minCupScore, SCORE.cup - SCORE.attemptPenalty * (attempt - 1));
  return cup + SCORE.star * stars + cleanTableBonus(pileSize);
}
