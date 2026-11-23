import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseShot } from './shot.ts';

const path = [
  { x: 10.4, y: 20.6 },
  { x: 30, y: 40 },
];

test('parseShot accepts a sinking shot and rounds its path', () => {
  assert.deepEqual(parseShot({ sunk: true, stars: 2, path }, 3), {
    sunk: true,
    stars: 2,
    path: [
      { x: 10, y: 21 },
      { x: 30, y: 40 },
    ],
    rest: null,
  });
});

test('parseShot keeps where a missed ball stopped', () => {
  assert.deepEqual(parseShot({ sunk: false, stars: 0, path, rest: { x: 300.6, y: 450 } }, 3)?.rest, { x: 301, y: 450 });
});

test('parseShot drops a rest point outside the table', () => {
  assert.equal(parseShot({ sunk: false, stars: 0, path, rest: { x: 300, y: 9999 } }, 3)?.rest, null);
  assert.equal(parseShot({ sunk: false, stars: 0, path, rest: 'here' }, 3)?.rest, null);
});

test('parseShot zeroes stars on a miss', () => {
  assert.equal(parseShot({ sunk: false, stars: 2, path }, 3)?.stars, 0);
});

test('parseShot rejects more stars than the level has', () => {
  assert.equal(parseShot({ sunk: true, stars: 4, path }, 3), undefined);
});

test('parseShot rejects a sink without a path', () => {
  assert.equal(parseShot({ sunk: true, stars: 0, path: [] }, 3), undefined);
});

test('parseShot rejects points far outside the playfield', () => {
  assert.equal(parseShot({ sunk: true, stars: 0, path: [{ x: 9999, y: 10 }] }, 3), undefined);
});

test('parseShot rejects malformed bodies', () => {
  assert.equal(parseShot(null, 3), undefined);
  assert.equal(parseShot({ sunk: 'yes', stars: 0, path }, 3), undefined);
  assert.equal(parseShot({ sunk: true, stars: 1.5, path }, 3), undefined);
  assert.equal(parseShot({ sunk: true, stars: 0, path: [{ x: '1', y: 2 }] }, 3), undefined);
});
