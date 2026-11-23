import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_LEVELS } from './levels.ts';
import type { Level } from './level.ts';
import { findSolution, simulateShot } from './sim.ts';

test('findSolution finds a sinking shot on a built-in level', () => {
  const level = BUILT_IN_LEVELS[0];
  assert.ok(level);
  const drag = findSolution(level);
  assert.ok(drag);
  assert.equal(simulateShot(level, drag).sunk, true);
});

test('findSolution returns null when the bin is sealed off', () => {
  const sealed: Level = {
    name: 'Sealed',
    author: null,
    ball: { x: 60, y: 540 },
    cup: { x: 280, y: 300 },
    walls: [
      { x: 280, y: 255, w: 120, h: 14, angle: 0 },
      { x: 220, y: 300, w: 14, h: 110, angle: 0 },
      { x: 340, y: 300, w: 14, h: 110, angle: 0 },
    ],
    bumpers: [],
    portals: [],
    fans: [],
    stars: [],
  };
  assert.equal(findSolution(sealed), null);
});
