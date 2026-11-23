// Brute-forces every built-in level with the real game physics and reports
// how many shots sink the ball, and where stars could sit on a sinking path.
// Run: npm run check:levels            (all levels)
//      npm run check:levels -- Zigzag  (one level, with star suggestions)
import type { Level, Point } from '../src/shared/level';
import { BUILT_IN_LEVELS } from '../src/shared/levels';
import { createSim, PHYSICS } from '../src/shared/sim';

const ANGLE_STEP = 1;
const POWER_STEPS = 12;
const STAR_SPOTS = [0.3, 0.55, 0.8];

type Sink = { angle: number; power: number; stars: number; path: Point[] };

function shoot(level: Level, angle: number, power: number) {
  const radians = (angle * Math.PI) / 180;
  const length = (PHYSICS.fullPowerDrag * power) / POWER_STEPS;
  const sim = createSim(level);
  sim.launch({ x: Math.cos(radians) * length, y: Math.sin(radians) * length });
  while (sim.status === 'flying') sim.step();
  return { sunk: sim.status === 'sunk', stars: sim.stars, path: sim.path() };
}

function check(level: Level, verbose: boolean) {
  const sinks: Sink[] = [];
  let shots = 0;
  for (let angle = 0; angle < 360; angle += ANGLE_STEP) {
    for (let power = 1; power <= POWER_STEPS; power += 1) {
      shots += 1;
      const result = shoot(level, angle, power);
      if (result.sunk) sinks.push({ angle, power, stars: result.stars, path: result.path });
    }
  }
  const bestStars = Math.max(0, ...sinks.map((sink) => sink.stars));
  const allStars = sinks.filter((sink) => sink.stars === level.stars.length).length;
  const rate = (sinks.length / shots) * 100;
  const verdict = sinks.length === 0 ? 'UNSOLVABLE' : rate > 8 ? 'too easy?' : 'ok';
  console.log(
    `${level.name.padEnd(14)} sinks ${String(sinks.length).padStart(4)}/${shots} (${rate.toFixed(2)}%)  best stars ${bestStars}/${level.stars.length}  all-star sinks ${allStars}  ${verdict}`
  );
  if (!verbose || sinks.length === 0) return;
  // Suggest stars along the longest sinking path: the most interesting route.
  const longest = [...sinks].sort((a, b) => b.path.length - a.path.length)[0];
  if (!longest) return;
  const visible = longest.path.filter((point) => point.y > 30 && point.y < 570);
  const spots = STAR_SPOTS.map((at) => visible[Math.floor(visible.length * at)]);
  console.log(`  longest sink: angle ${longest.angle}, power ${longest.power}/${POWER_STEPS}, ${longest.path.length} points`);
  console.log(`  suggested stars: ${JSON.stringify(spots)}`);
}

const only = process.argv[2];
for (const level of BUILT_IN_LEVELS) {
  if (only && level.name !== only) continue;
  check(level, Boolean(only));
}
