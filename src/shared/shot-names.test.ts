import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nameShot } from './shot-names.ts';

const none = { walls: 0, bumpers: 0, portals: 0, pileBalls: 0, owners: [] };

test('a clean first-try sink is a hole in one and a swish', () => {
  assert.deepEqual(nameShot(none, 1), ['Hole in one', 'Swish']);
});

test('one wall is a bank shot, many contacts a ricochet', () => {
  assert.deepEqual(nameShot({ ...none, walls: 1 }, 2), ['Bank shot']);
  assert.deepEqual(nameShot({ ...none, walls: 2, pileBalls: 2 }, 3), ['Ricochet ×4']);
});

test('bouncing off another player’s miss credits them first', () => {
  assert.deepEqual(nameShot({ ...none, pileBalls: 1, owners: ['quietfox'] }, 2), ['Assist from u/quietfox']);
  assert.equal(nameShot({ ...none, pileBalls: 2, owners: ['a_b', 'c_d'] }, 2)[0], 'Assist from u/a_b +1');
});

test('vents and bumpers get their own names', () => {
  assert.deepEqual(nameShot({ ...none, portals: 1 }, 2), ['Through the vent']);
  assert.deepEqual(nameShot({ ...none, bumpers: 2 }, 2), ['Pinball']);
});

test('never more than three names', () => {
  assert.equal(nameShot({ walls: 3, bumpers: 3, portals: 1, pileBalls: 1, owners: ['x_y'] }, 1).length, 3);
});
