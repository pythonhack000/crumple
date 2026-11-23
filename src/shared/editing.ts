import type { Level, Point, Wall } from './level';
import { WORLD } from './level';
import { PHYSICS } from './physics';

/** What the player grabbed in the level editor. */
export type Pick =
  | { kind: 'ball' }
  | { kind: 'cup' }
  | { kind: 'wall'; index: number; handle: 'body' | 'a' | 'b' }
  | { kind: 'bumper'; index: number }
  | { kind: 'star'; index: number }
  | { kind: 'fan'; index: number }
  | { kind: 'vent'; index: number; end: 'a' | 'b' };

const GRAB = 28;
const HANDLE = 22;
const MIN_WALL = 24;
const MAX_WALL = 360;

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const clampX = (x: number) => Math.round(Math.min(WORLD.width, Math.max(0, x)));
const clampY = (y: number) => Math.round(Math.min(WORLD.height, Math.max(0, y)));
const clampPoint = (p: Point): Point => ({ x: clampX(p.x), y: clampY(p.y) });

/** The two ends of a shelf, along its long side (tall walls run vertically). */
export function wallEnds(wall: Wall): { a: Point; b: Point } {
  const isTall = wall.h > wall.w;
  const r = ((wall.angle + (isTall ? 90 : 0)) * Math.PI) / 180;
  const length = Math.max(wall.w, wall.h);
  const dx = (Math.cos(r) * length) / 2;
  const dy = (Math.sin(r) * length) / 2;
  return { a: { x: wall.x - dx, y: wall.y - dy }, b: { x: wall.x + dx, y: wall.y + dy } };
}

/** Builds a shelf between two points, keeping its thickness. */
export function wallBetween(a: Point, b: Point, h: number): Wall {
  const length = Math.min(MAX_WALL, Math.max(MIN_WALL, dist(a, b)));
  let angle = Math.round((Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI);
  if (angle > 90) angle -= 180;
  if (angle < -90) angle += 180;
  return { x: clampX((a.x + b.x) / 2), y: clampY((a.y + b.y) / 2), w: Math.round(length), h, angle };
}

function onWall(wall: Wall, at: Point): boolean {
  const r = (-wall.angle * Math.PI) / 180;
  const dx = at.x - wall.x;
  const dy = at.y - wall.y;
  const lx = dx * Math.cos(r) - dy * Math.sin(r);
  const ly = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(lx) <= wall.w / 2 + 6 && Math.abs(ly) <= wall.h / 2 + 10;
}

/** Finds the piece under `at`, smallest and most specific first. */
export function pickPiece(level: Level, at: Point): Pick | null {
  if (dist(level.ball, at) < GRAB) return { kind: 'ball' };
  const star = level.stars.findIndex((s) => dist(s, at) < GRAB);
  if (star >= 0) return { kind: 'star', index: star };
  for (let index = 0; index < level.portals.length; index += 1) {
    const portal = level.portals[index];
    if (portal && dist(portal.a, at) < PHYSICS.portalRadius + 6) return { kind: 'vent', index, end: 'a' };
    if (portal && dist(portal.b, at) < PHYSICS.portalRadius + 6) return { kind: 'vent', index, end: 'b' };
  }
  if (Math.abs(at.x - level.cup.x) < PHYSICS.cupInner / 2 + 10 && Math.abs(at.y - level.cup.y) < PHYSICS.cupDepth / 2 + 10) {
    return { kind: 'cup' };
  }
  for (let index = level.walls.length - 1; index >= 0; index -= 1) {
    const wall = level.walls[index];
    if (!wall) continue;
    const { a, b } = wallEnds(wall);
    if (dist(a, at) < HANDLE) return { kind: 'wall', index, handle: 'a' };
    if (dist(b, at) < HANDLE) return { kind: 'wall', index, handle: 'b' };
    if (onWall(wall, at)) return { kind: 'wall', index, handle: 'body' };
  }
  const bumper = level.bumpers.findIndex((b) => dist(b, at) < b.r + 6);
  if (bumper >= 0) return { kind: 'bumper', index: bumper };
  const fan = level.fans.findIndex((f) => Math.abs(f.x - at.x) < f.w / 2 && Math.abs(f.y - at.y) < f.h / 2);
  if (fan >= 0) return { kind: 'fan', index: fan };
  return null;
}

const replaceAt = <T>(items: readonly T[], index: number, next: T): T[] =>
  items.map((item, i) => (i === index ? next : item));

/**
 * Applies a drag from `from` to `to` on the grabbed piece of `base` (the level
 * as it was when the drag started). Returns a new level; `base` is untouched.
 */
export function movePiece(base: Level, pick: Pick, from: Point, to: Point): Level {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const shift = (p: Point): Point => clampPoint({ x: p.x + dx, y: p.y + dy });
  switch (pick.kind) {
    case 'ball':
      return { ...base, ball: shift(base.ball) };
    case 'cup':
      return { ...base, cup: shift(base.cup) };
    case 'star': {
      const star = base.stars[pick.index];
      return star ? { ...base, stars: replaceAt(base.stars, pick.index, shift(star)) } : base;
    }
    case 'bumper': {
      const bumper = base.bumpers[pick.index];
      return bumper ? { ...base, bumpers: replaceAt(base.bumpers, pick.index, { ...bumper, ...shift(bumper) }) } : base;
    }
    case 'fan': {
      const fan = base.fans[pick.index];
      return fan ? { ...base, fans: replaceAt(base.fans, pick.index, { ...fan, ...shift(fan) }) } : base;
    }
    case 'vent': {
      const portal = base.portals[pick.index];
      if (!portal) return base;
      const moved = pick.end === 'a' ? { ...portal, a: shift(portal.a) } : { ...portal, b: shift(portal.b) };
      return { ...base, portals: replaceAt(base.portals, pick.index, moved) };
    }
    case 'wall': {
      const wall = base.walls[pick.index];
      if (!wall) return base;
      if (pick.handle === 'body') return { ...base, walls: replaceAt(base.walls, pick.index, { ...wall, ...shift(wall) }) };
      // Dragging an end rotates and stretches the shelf around its other end.
      const { a, b } = wallEnds(wall);
      const thickness = Math.min(wall.w, wall.h);
      const next = pick.handle === 'a' ? wallBetween(shift(a), b, thickness) : wallBetween(a, shift(b), thickness);
      return { ...base, walls: replaceAt(base.walls, pick.index, next) };
    }
  }
}
