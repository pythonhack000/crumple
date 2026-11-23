import type { Level } from './level';

const base = {
  author: null,
  bumpers: [],
  portals: [],
  fans: [],
  walls: [],
  stars: [],
};

/**
 * Built-in levels, in the order they are served as daily levels.
 * The playfield is 360 x 600, gravity pulls down, the bottom edge is open.
 */
export const BUILT_IN_LEVELS: readonly Level[] = [
  {
    ...base,
    name: 'Monday, first coffee',
    ball: { x: 60, y: 500 },
    cup: { x: 290, y: 430 },
    walls: [
      { x: 60, y: 520, w: 80, h: 12, angle: 0 },
      { x: 290, y: 470, w: 90, h: 12, angle: 0 },
    ],
    stars: [
      { x: 150, y: 330 },
      { x: 220, y: 330 },
    ],
  },
  {
    ...base,
    name: 'Cubicle wall',
    ball: { x: 50, y: 540 },
    cup: { x: 300, y: 520 },
    walls: [
      { x: 50, y: 560, w: 70, h: 12, angle: 0 },
      { x: 190, y: 430, w: 16, h: 300, angle: 0 },
      { x: 300, y: 560, w: 100, h: 12, angle: 0 },
    ],
    stars: [
      { x: 252, y: 113 },
      { x: 339, y: 503 },
      { x: 288, y: 487 },
    ],
  },
  {
    ...base,
    name: 'Off the whiteboard',
    ball: { x: 60, y: 540 },
    cup: { x: 80, y: 250 },
    walls: [
      { x: 60, y: 560, w: 80, h: 12, angle: 0 },
      { x: 80, y: 290, w: 110, h: 12, angle: 0 },
      { x: 190, y: 330, w: 14, h: 420, angle: 0 },
      { x: 320, y: 200, w: 140, h: 12, angle: -35 },
    ],
    stars: [
      { x: 62, y: 124 },
      { x: 41, y: 163 },
      { x: 92, y: 224 },
    ],
  },
  {
    ...base,
    name: 'Stress balls',
    ball: { x: 180, y: 560 },
    cup: { x: 180, y: 120 },
    walls: [{ x: 180, y: 580, w: 70, h: 12, angle: 0 }],
    bumpers: [
      { x: 105, y: 340, r: 20 },
      { x: 255, y: 340, r: 20 },
      { x: 180, y: 250, r: 16 },
      { x: 70, y: 190, r: 14 },
      { x: 290, y: 190, r: 14 },
    ],
    stars: [
      { x: 137, y: 360 },
      { x: 142, y: 279 },
      { x: 157, y: 180 },
    ],
  },
  {
    ...base,
    name: 'Desk fan',
    ball: { x: 50, y: 540 },
    cup: { x: 300, y: 120 },
    walls: [
      { x: 50, y: 560, w: 70, h: 12, angle: 0 },
      { x: 300, y: 160, w: 90, h: 12, angle: 0 },
      { x: 240, y: 300, w: 12, h: 260, angle: 0 },
    ],
    fans: [{ x: 160, y: 380, w: 80, h: 300, angle: -90 }],
    stars: [
      { x: 160, y: 140 },
      { x: 160, y: 300 },
    ],
  },
  {
    ...base,
    name: 'Air vent',
    ball: { x: 60, y: 540 },
    cup: { x: 290, y: 140 },
    walls: [
      { x: 60, y: 560, w: 80, h: 12, angle: 0 },
      { x: 290, y: 180, w: 120, h: 12, angle: 0 },
      { x: 230, y: 110, w: 12, h: 150, angle: 0 },
      { x: 290, y: 40, w: 120, h: 12, angle: 0 },
      { x: 180, y: 300, w: 360, h: 14, angle: 0 },
    ],
    portals: [{ a: { x: 180, y: 420 }, b: { x: 300, y: 90 } }],
    stars: [
      { x: 119, y: 317 },
      { x: 152, y: 394 },
    ],
  },
  {
    ...base,
    name: 'Bookshelves',
    ball: { x: 320, y: 560 },
    cup: { x: 70, y: 300 },
    walls: [
      { x: 320, y: 580, w: 70, h: 12, angle: 0 },
      { x: 140, y: 440, w: 170, h: 12, angle: 12 },
      { x: 240, y: 250, w: 170, h: 12, angle: -14 },
      { x: 110, y: 120, w: 150, h: 12, angle: 10 },
    ],
    stars: [
      { x: 312, y: 73 },
      { x: 267, y: 186 },
      { x: 152, y: 202 },
    ],
  },
  {
    ...base,
    name: 'Friday, 4:59 pm',
    ball: { x: 40, y: 560 },
    cup: { x: 320, y: 300 },
    walls: [
      { x: 40, y: 580, w: 60, h: 12, angle: 0 },
      { x: 320, y: 340, w: 70, h: 12, angle: 0 },
      { x: 270, y: 260, w: 12, h: 160, angle: 0 },
      { x: 150, y: 460, w: 120, h: 12, angle: -25 },
    ],
    bumpers: [{ x: 200, y: 180, r: 20 }],
    fans: [{ x: 90, y: 300, w: 70, h: 220, angle: -70 }],
    portals: [{ a: { x: 330, y: 80 }, b: { x: 320, y: 230 } }],
    stars: [
      { x: 90, y: 160 },
      { x: 250, y: 90 },
      { x: 200, y: 380 },
    ],
  },
];

/** The built-in level for a day number (1-based), cycling through the list. */
export function builtInLevelFor(dayNumber: number): Level {
  const count = BUILT_IN_LEVELS.length;
  const level = BUILT_IN_LEVELS[(((dayNumber - 1) % count) + count) % count];
  if (!level) throw new Error('No built-in levels');
  return level;
}
