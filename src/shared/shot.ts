import type { Point } from './level';
import { WORLD } from './level';
import { PHYSICS } from './sim';
import type { ShotRequest } from './api';

const MARGIN = 80;

/**
 * Validates a shot report from the client. Returns undefined for anything a
 * real shot could not produce, so tampered requests are rejected.
 */
export function parseShot(body: unknown, starCount: number): ShotRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  const { sunk, stars, path, rest, owners } = body as Record<string, unknown>;
  if (typeof sunk !== 'boolean') return undefined;
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 0 || stars > starCount) return undefined;
  if (!Array.isArray(path) || path.length > PHYSICS.pathMax) return undefined;
  const points: Point[] = [];
  for (const item of path) {
    if (typeof item !== 'object' || item === null) return undefined;
    const { x, y } = item as Record<string, unknown>;
    if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return undefined;
    if (x < -MARGIN || x > WORLD.width + MARGIN || y < -MARGIN || y > WORLD.height + MARGIN) return undefined;
    points.push({ x: Math.round(x), y: Math.round(y) });
  }
  if (sunk && points.length === 0) return undefined;
  return { sunk, stars: sunk ? stars : 0, path: points, rest: sunk ? null : parseRest(rest), owners: sunk ? parseOwners(owners) : [] };
}

const USERNAME = /^[A-Za-z0-9_-]{3,40}$/;
const MAX_OWNERS = 5;

function parseOwners(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names = value.filter((name): name is string => typeof name === 'string' && USERNAME.test(name));
  return [...new Set(names)].slice(0, MAX_OWNERS);
}

function parseRest(value: unknown): Point | null {
  if (typeof value !== 'object' || value === null) return null;
  const { x, y } = value as Record<string, unknown>;
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  if (!(x >= 0 && x <= WORLD.width && y >= 0 && y <= WORLD.height)) return null;
  return { x: Math.round(x), y: Math.round(y) };
}
