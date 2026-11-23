import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayKeyOf, daysBetween, nextStreak } from './game.ts';

test('dayKeyOf uses the UTC calendar day', () => {
  assert.equal(dayKeyOf(new Date('2026-12-01T23:59:59Z')), '2026-12-01');
  assert.equal(dayKeyOf(new Date('2026-12-02T00:00:00Z')), '2026-12-02');
});

test('daysBetween counts whole UTC days', () => {
  assert.equal(daysBetween('2026-11-30', '2026-12-02'), 2);
  assert.equal(daysBetween('2026-12-02', '2026-12-02'), 0);
});

test('nextStreak starts at one for a first play', () => {
  assert.deepEqual(nextStreak(undefined, 0, '2026-12-02'), 1);
});

test('nextStreak grows when the last play was yesterday', () => {
  assert.equal(nextStreak('2026-12-01', 4, '2026-12-02'), 5);
});

test('nextStreak keeps the streak when played twice on one day', () => {
  assert.equal(nextStreak('2026-12-02', 4, '2026-12-02'), 4);
});

test('nextStreak resets after a missed day', () => {
  assert.equal(nextStreak('2026-11-29', 4, '2026-12-02'), 1);
});
