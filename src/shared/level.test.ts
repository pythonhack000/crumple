import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LIMITS, parseLevel, SCORE, shotScore } from './level.ts';

const valid = {
  name: 'First bounce',
  ball: { x: 40, y: 500 },
  cup: { x: 300, y: 200 },
  walls: [{ x: 180, y: 300, w: 120, h: 12, angle: 15 }],
  bumpers: [{ x: 100, y: 200, r: 16 }],
  portals: [{ a: { x: 50, y: 50 }, b: { x: 300, y: 500 } }],
  fans: [{ x: 200, y: 100, w: 60, h: 120, angle: -90 }],
  stars: [{ x: 200, y: 250 }],
};

test('parseLevel accepts a valid level and fills a missing author', () => {
  const level = parseLevel(valid);
  assert.ok(level);
  assert.equal(level.author, null);
  assert.equal(level.walls.length, 1);
});

test('parseLevel treats missing lists as empty', () => {
  const level = parseLevel({ name: 'Bare', ball: { x: 10, y: 10 }, cup: { x: 20, y: 20 } });
  assert.deepEqual(level?.walls, []);
  assert.deepEqual(level?.stars, []);
});

test('parseLevel rejects pieces outside the playfield', () => {
  assert.equal(parseLevel({ ...valid, cup: { x: 999, y: 20 } }), undefined);
});

test('parseLevel rejects too many pieces', () => {
  const stars = Array.from({ length: LIMITS.stars + 1 }, () => ({ x: 10, y: 10 }));
  assert.equal(parseLevel({ ...valid, stars }), undefined);
});

test('parseLevel rejects a level without a name', () => {
  assert.equal(parseLevel({ ...valid, name: '   ' }), undefined);
});

test('parseLevel rejects non-numeric coordinates', () => {
  assert.equal(parseLevel({ ...valid, ball: { x: '40', y: 500 } }), undefined);
});

test('shotScore rewards a first-try cup with stars', () => {
  assert.equal(shotScore(1, 3), SCORE.cup + 3 * SCORE.star);
});

test('shotScore loses points per extra attempt but never below the floor', () => {
  assert.equal(shotScore(3, 0), SCORE.cup - 2 * SCORE.attemptPenalty);
  assert.equal(shotScore(50, 0), SCORE.minCupScore);
});
