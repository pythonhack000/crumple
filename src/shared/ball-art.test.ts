import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BALL_ART, parseBallArt } from './ball-art.ts';

const png = `${BALL_ART.prefix}iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;

test('parseBallArt accepts a small PNG data URL', () => {
  assert.equal(parseBallArt(png), png);
});

test('parseBallArt rejects other image types and plain strings', () => {
  assert.equal(parseBallArt('data:image/svg+xml;base64,PHN2Zz4='), undefined);
  assert.equal(parseBallArt('hello'), undefined);
  assert.equal(parseBallArt(42), undefined);
});

test('parseBallArt rejects data that is not a PNG or not base64', () => {
  assert.equal(parseBallArt(`${BALL_ART.prefix}R0lGODlhAQABAAAAACw=`), undefined);
  assert.equal(parseBallArt(`${BALL_ART.prefix}iVBORw<script>`), undefined);
});

test('parseBallArt rejects oversized images', () => {
  assert.equal(parseBallArt(`${BALL_ART.prefix}iVBORw${'A'.repeat(BALL_ART.maxBytes * 2)}`), undefined);
});
