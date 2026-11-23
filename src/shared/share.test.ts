import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shareText } from './share.ts';

const base = { dayNumber: 12, levelName: 'Cubicle wall', twist: undefined, attempt: 3, stars: 2, starCount: 3, score: 162, names: ['Bank shot'] };

test('shareText reads like a person typed it and never shows the path', () => {
  assert.equal(shareText(base), 'Crumple #12, Cubicle wall\nMissed twice, sank it on throw 3\n2 of 3 stars, 162 points, bank shot');
  assert.match(shareText({ ...base, attempt: 2 }), /Missed once, sank it on throw 2/);
});

test('shareText celebrates a first throw and names the twist', () => {
  const text = shareText({ ...base, attempt: 1, twist: 'moon', names: [] });
  assert.match(text, /Cubicle wall \(moon day\)/);
  assert.match(text, /Sank it on the first throw/);
});

test('shareText counts long runs of misses', () => {
  assert.match(shareText({ ...base, attempt: 25 }), /Missed 24 times, sank it on throw 25/);
});

test('shareText has no emoji and no star glyphs', () => {
  assert.doesNotMatch(shareText(base), /[\u{1F300}-\u{1FAFF}★☆⬜🟧]/u);
});
