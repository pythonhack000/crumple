import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BUILT_IN_LEVELS } from './levels.ts';
import type { Level } from './level.ts';
import { createSim, findSolution, simulateShot } from './sim.ts';

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

const open: Level = {
  name: 'Open',
  author: null,
  ball: { x: 60, y: 540 },
  cup: { x: 300, y: 200 },
  walls: [{ x: 180, y: 300, w: 200, h: 12, angle: 0 }],
  bumpers: [],
  portals: [],
  fans: [],
  stars: [],
};

function peak(level: Level, drag: { x: number; y: number }, steps: number): number {
  const sim = createSim(level);
  sim.launch(drag);
  let top = Infinity;
  for (let i = 0; i < steps && sim.status === 'flying'; i += 1) {
    sim.step();
    top = Math.min(top, sim.ball.position.y);
  }
  return top;
}

test('moon day makes the ball fly higher', () => {
  const drag = { x: -10, y: 40 };
  assert.ok(peak({ ...open, twist: 'moon' }, drag, 200) < peak(open, drag, 200));
});

test('glass day shatters the ball on a hard hit', () => {
  const sim = createSim({ ...open, twist: 'glass' });
  sim.launch({ x: -140, y: 0 });
  const events = [];
  while (sim.status === 'flying') events.push(...sim.step());
  assert.ok(events.some((event) => event.type === 'miss' && event.reason === 'shatter'));
});

test('the bin moves during the throw on moving-bin days', () => {
  const sim = createSim({ ...open, twist: 'moving-bin' });
  assert.equal(sim.cupPosition().x, 300);
  sim.launch({ x: 0, y: 5 });
  for (let i = 0; i < 40 && sim.status === 'flying'; i += 1) sim.step();
  assert.notEqual(sim.cupPosition().x, 300);
});

test('bouncing off another player’s miss records who it belonged to', () => {
  const sim = createSim(open, [{ x: 140, y: 550, owner: 'quietfox' }]);
  sim.launch({ x: -60, y: 0 });
  while (sim.status === 'flying') sim.step();
  assert.deepEqual(sim.stats().owners, ['quietfox']);
});
