import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CALL_POINTS,
  dayKeyOf,
  daysBetween,
  majorityOf,
  nextStreak,
  percentages,
  scoreCall,
} from './game.ts';

test('majorityOf returns the single top option', () => {
  assert.deepEqual(majorityOf([3, 9, 1]), [1]);
});

test('majorityOf returns every option tied for the top', () => {
  assert.deepEqual(majorityOf([5, 2, 5]), [0, 2]);
});

test('majorityOf returns nothing when nobody voted', () => {
  assert.deepEqual(majorityOf([0, 0, 0]), []);
});

test('scoreCall gives full points for calling the majority', () => {
  assert.equal(scoreCall(1, [3, 9, 1]), CALL_POINTS.majority);
});

test('scoreCall gives full points for any option tied for the top', () => {
  assert.equal(scoreCall(2, [5, 2, 5]), CALL_POINTS.majority);
});

test('scoreCall gives runner-up points for the clear second place', () => {
  assert.equal(scoreCall(0, [3, 9, 1]), CALL_POINTS.runnerUp);
});

test('scoreCall gives nothing for a losing call', () => {
  assert.equal(scoreCall(2, [3, 9, 1]), 0);
});

test('scoreCall gives nothing when nobody voted', () => {
  assert.equal(scoreCall(0, [0, 0]), 0);
});

test('percentages round to whole numbers that sum to 100', () => {
  const result = percentages([1, 1, 1]);
  assert.equal(
    result.reduce((sum, value) => sum + value, 0),
    100
  );
  assert.deepEqual(percentages([0, 0]), [0, 0]);
  assert.deepEqual(percentages([3, 1]), [75, 25]);
});

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
