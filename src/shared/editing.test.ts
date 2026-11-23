import { test } from 'node:test';
import assert from 'node:assert/strict';
import { movePiece, pickPiece, wallBetween, wallEnds } from './editing.ts';
import type { Level } from './level.ts';

const level: Level = {
  name: 'Test',
  author: null,
  ball: { x: 60, y: 540 },
  cup: { x: 290, y: 300 },
  walls: [{ x: 180, y: 400, w: 100, h: 12, angle: 0 }],
  bumpers: [{ x: 100, y: 200, r: 18 }],
  portals: [{ a: { x: 50, y: 100 }, b: { x: 300, y: 500 } }],
  fans: [],
  stars: [{ x: 200, y: 150 }],
};

test('pickPiece finds the ball, a star, a vent end and the bin', () => {
  assert.deepEqual(pickPiece(level, { x: 62, y: 538 }), { kind: 'ball' });
  assert.deepEqual(pickPiece(level, { x: 205, y: 150 }), { kind: 'star', index: 0 });
  assert.deepEqual(pickPiece(level, { x: 300, y: 505 }), { kind: 'vent', index: 0, end: 'b' });
  assert.deepEqual(pickPiece(level, { x: 290, y: 300 }), { kind: 'cup' });
});

test('pickPiece tells a shelf end from its middle', () => {
  assert.deepEqual(pickPiece(level, { x: 131, y: 400 }), { kind: 'wall', index: 0, handle: 'a' });
  assert.deepEqual(pickPiece(level, { x: 180, y: 402 }), { kind: 'wall', index: 0, handle: 'body' });
});

test('pickPiece returns null on empty paper', () => {
  assert.equal(pickPiece(level, { x: 330, y: 60 }), null);
});

test('movePiece moves a piece without touching the original level', () => {
  const moved = movePiece(level, { kind: 'star', index: 0 }, { x: 200, y: 150 }, { x: 230, y: 170 });
  assert.deepEqual(moved.stars[0], { x: 230, y: 170 });
  assert.deepEqual(level.stars[0], { x: 200, y: 150 });
});

test('movePiece keeps pieces on the page', () => {
  const moved = movePiece(level, { kind: 'ball' }, { x: 60, y: 540 }, { x: -500, y: 9000 });
  assert.deepEqual(moved.ball, { x: 0, y: 600 });
});

test('dragging a shelf end rotates it around the other end', () => {
  const moved = movePiece(level, { kind: 'wall', index: 0, handle: 'b' }, { x: 230, y: 400 }, { x: 230, y: 350 });
  const wall = moved.walls[0];
  assert.ok(wall);
  const { a } = wallEnds(wall);
  assert.ok(Math.abs(a.x - 130) < 1.5 && Math.abs(a.y - 400) < 1.5);
  assert.ok(wall.angle < 0);
});

test('wallBetween keeps shelves at least a usable length', () => {
  assert.equal(wallBetween({ x: 100, y: 100 }, { x: 101, y: 100 }, 12).w, 24);
});

test('a tall wall has its ends at the top and bottom', () => {
  const { a, b } = wallEnds({ x: 100, y: 300, w: 14, h: 200, angle: 0 });
  assert.ok(Math.abs(a.x - 100) < 0.01 && Math.abs(b.x - 100) < 0.01);
  assert.ok(Math.abs(Math.abs(a.y - b.y) - 200) < 0.01);
});
