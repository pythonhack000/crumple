import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText } from './share.ts';

const base = { dayNumber: 12, levelName: 'Cubicle wall', twist: undefined, attempt: 3, stars: 2, starCount: 3, score: 162, names: ['Bank shot'] };

test('shareText shows misses as squares and never the path', () => {
  assert.equal(shareText(base), 'Crumple #12 · Cubicle wall\n⬜⬜🟧 in on throw 3\n★★☆ · 162 points · Bank shot');
});

test('shareText celebrates a first throw and names the twist', () => {
  const text = shareText({ ...base, attempt: 1, twist: 'moon', names: [] });
  assert.match(text, /· Moon day/);
  assert.match(text, /🟧 in on first throw/);
});

test('shareText compresses long runs of misses', () => {
  assert.match(shareText({ ...base, attempt: 25 }), /⬜×24 🟧/);
});
