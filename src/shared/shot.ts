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
  const { sunk, stars, path } = body as Record<string, unknown>;
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
  return { sunk, stars: sunk ? stars : 0, path: points };
}
