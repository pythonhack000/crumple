import Matter from 'matter-js';
import type { Level, Point } from './level';
import { WORLD } from './level';

/** Tuning shared by the game and the level checker, so both agree on physics. */
export const PHYSICS = {
  stepMs: 1000 / 60,
  ballRadius: 10,
  maxSpeed: 21,
  /** Drag distance (px) that gives full power. */
  fullPowerDrag: 140,
  fanAccel: 0.5,
  portalRadius: 16,
  starRadius: 12,
  cupInner: 34,
  cupDepth: 30,
  restSpeed: 0.12,
  restSteps: 45,
  maxSteps: 60 * 12,
  pathEvery: 3,
  pathMax: 240,
  portalCooldown: 20,
} as const;

export type SimEvent =
  | { type: 'star'; index: number }
  | { type: 'portal' }
  | { type: 'bump' }
  | { type: 'hit'; speed: number }
  | { type: 'cup' }
  | { type: 'miss'; reason: 'out' | 'rest' | 'time' };

export type SimStatus = 'aiming' | 'flying' | 'sunk' | 'missed';

type Kind = 'ball' | 'wall' | 'bumper' | 'cup' | 'cupSensor' | 'star' | 'portal' | 'fan' | 'edge';
type Tag = { kind: Kind; index: number; end?: 'a' | 'b' };

const tags = new WeakMap<Matter.Body, Tag>();
const tag = (body: Matter.Body, value: Tag) => {
  tags.set(body, value);
  return body;
};

/** Turns a drag vector (from the ball to the pointer) into a launch velocity. */
export function launchVelocity(drag: Point): Point {
  const length = Math.hypot(drag.x, drag.y);
  if (length === 0) return { x: 0, y: 0 };
  const power = Math.min(length, PHYSICS.fullPowerDrag) / PHYSICS.fullPowerDrag;
  const speed = power * PHYSICS.maxSpeed;
  // Pull back to shoot forward, like a slingshot.
  return { x: (-drag.x / length) * speed, y: (-drag.y / length) * speed };
}

/** Gravity per step in px/step², matching Matter's default integration. */
export function gravityPerStep(engine: Matter.Engine): number {
  return engine.gravity.y * engine.gravity.scale * PHYSICS.stepMs * PHYSICS.stepMs;
}

/** Points along the first part of a shot, ignoring collisions. */
export function previewArc(from: Point, velocity: Point, gravity: number, steps = 26, every = 2): Point[] {
  const points: Point[] = [];
  let { x, y } = from;
  let vx = velocity.x;
  let vy = velocity.y;
  for (let step = 1; step <= steps * every; step += 1) {
    vy += gravity;
    x += vx;
    y += vy;
    if (step % every === 0) points.push({ x, y });
  }
  return points;
}

function cupBodies(cup: Point): Matter.Body[] {
  const { cupInner, cupDepth } = PHYSICS;
  const wall = 6;
  const opts = { isStatic: true, restitution: 0.1, friction: 0.6 };
  const left = Matter.Bodies.rectangle(cup.x - cupInner / 2 - wall / 2, cup.y, wall, cupDepth, opts);
  const right = Matter.Bodies.rectangle(cup.x + cupInner / 2 + wall / 2, cup.y, wall, cupDepth, opts);
  const bottom = Matter.Bodies.rectangle(cup.x, cup.y + cupDepth / 2 + wall / 2, cupInner + wall * 2, wall, opts);
  const sensor = Matter.Bodies.rectangle(cup.x, cup.y + cupDepth / 4, cupInner - 4, cupDepth / 2, {
    isStatic: true,
    isSensor: true,
  });
  return [tag(left, { kind: 'cup', index: 0 }), tag(right, { kind: 'cup', index: 1 }), tag(bottom, { kind: 'cup', index: 2 }), tag(sensor, { kind: 'cupSensor', index: 0 })];
}

function edgeBodies(): Matter.Body[] {
  const t = 40;
  const opts = { isStatic: true, restitution: 0.3 };
  return [
    Matter.Bodies.rectangle(-t / 2, WORLD.height / 2, t, WORLD.height * 3, opts),
    Matter.Bodies.rectangle(WORLD.width + t / 2, WORLD.height / 2, t, WORLD.height * 3, opts),
    Matter.Bodies.rectangle(WORLD.width / 2, -t / 2, WORLD.width + t * 2, t, opts),
  ].map((body, index) => tag(body, { kind: 'edge', index }));
}

export type Sim = ReturnType<typeof createSim>;

export function createSim(level: Level) {
  const engine = Matter.Engine.create({ enableSleeping: false });
  const ball = tag(
    Matter.Bodies.circle(level.ball.x, level.ball.y, PHYSICS.ballRadius, {
      restitution: 0.55,
      friction: 0.02,
      frictionAir: 0.004,
      density: 0.002,
    }),
    { kind: 'ball', index: 0 }
  );
  // Freeze the ball until the shot. Must happen after creation: a body created
  // static has no stored mass and becomes NaN when it is released.
  Matter.Body.setStatic(ball, true);

  const walls = level.walls.map((w, index) =>
    tag(
      Matter.Bodies.rectangle(w.x, w.y, w.w, w.h, {
        isStatic: true,
        angle: (w.angle * Math.PI) / 180,
        restitution: 0.3,
        friction: 0.3,
      }),
      { kind: 'wall', index }
    )
  );
  const bumpers = level.bumpers.map((b, index) =>
    tag(Matter.Bodies.circle(b.x, b.y, b.r, { isStatic: true, restitution: 1.25 }), { kind: 'bumper', index })
  );
  const stars = level.stars.map((s, index) =>
    tag(Matter.Bodies.circle(s.x, s.y, PHYSICS.starRadius, { isStatic: true, isSensor: true }), { kind: 'star', index })
  );
  const portals = level.portals.flatMap((p, index) => [
    tag(Matter.Bodies.circle(p.a.x, p.a.y, PHYSICS.portalRadius, { isStatic: true, isSensor: true }), { kind: 'portal', index, end: 'a' }),
    tag(Matter.Bodies.circle(p.b.x, p.b.y, PHYSICS.portalRadius, { isStatic: true, isSensor: true }), { kind: 'portal', index, end: 'b' }),
  ]);
  const fans = level.fans.map((f, index) =>
    tag(Matter.Bodies.rectangle(f.x, f.y, f.w, f.h, { isStatic: true, isSensor: true }), { kind: 'fan', index })
  );

  Matter.Composite.add(engine.world, [ball, ...walls, ...bumpers, ...stars, ...portals, ...fans, ...cupBodies(level.cup), ...edgeBodies()]);

  let status: SimStatus = 'aiming';
  let steps = 0;
  let restSteps = 0;
  let portalCooldown = 0;
  const activeFans = new Set<number>();
  const collected = new Set<number>();
  const path: Point[] = [];
  let pending: SimEvent[] = [];

  Matter.Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const other = pair.bodyA === ball ? pair.bodyB : pair.bodyB === ball ? pair.bodyA : undefined;
      const info = other ? tags.get(other) : undefined;
      if (!other || !info || status !== 'flying') continue;
      if (info.kind === 'star' && !collected.has(info.index)) {
        collected.add(info.index);
        pending.push({ type: 'star', index: info.index });
      } else if (info.kind === 'cupSensor') {
        status = 'sunk';
        pending.push({ type: 'cup' });
      } else if (info.kind === 'fan') {
        activeFans.add(info.index);
      } else if (info.kind === 'portal' && portalCooldown === 0) {
        const portal = level.portals[info.index];
        const exit = portal && (info.end === 'a' ? portal.b : portal.a);
        if (exit) {
          Matter.Body.setPosition(ball, exit);
          portalCooldown = PHYSICS.portalCooldown;
          pending.push({ type: 'portal' });
        }
      } else if (info.kind === 'bumper') {
        pending.push({ type: 'bump' });
      } else if (info.kind === 'wall' || info.kind === 'cup' || info.kind === 'edge') {
        pending.push({ type: 'hit', speed: Matter.Vector.magnitude(ball.velocity) });
      }
    }
  });
  Matter.Events.on(engine, 'collisionEnd', (event) => {
    for (const pair of event.pairs) {
      const other = pair.bodyA === ball ? pair.bodyB : pair.bodyB === ball ? pair.bodyA : undefined;
      const info = other ? tags.get(other) : undefined;
      if (info?.kind === 'fan') activeFans.delete(info.index);
    }
  });

  const currentStatus = (): SimStatus => status;

  const finishMiss = (reason: 'out' | 'rest' | 'time'): SimEvent[] => {
    status = 'missed';
    return [{ type: 'miss', reason }];
  };

  return {
    engine,
    ball,
    level,
    get status() {
      return status;
    },
    get stars() {
      return collected.size;
    },
    collectedStars: () => new Set(collected),
    path: () => [...path],
    launch(drag: Point) {
      if (status !== 'aiming') return;
      const velocity = launchVelocity(drag);
      Matter.Body.setStatic(ball, false);
      Matter.Body.setVelocity(ball, velocity);
      status = 'flying';
    },
    /** Advances one fixed step and returns what happened during it. */
    step(): SimEvent[] {
      if (status !== 'flying') return [];
      for (const index of activeFans) {
        const fan = level.fans[index];
        if (!fan) continue;
        const radians = (fan.angle * Math.PI) / 180;
        Matter.Body.setVelocity(ball, {
          x: ball.velocity.x + Math.cos(radians) * PHYSICS.fanAccel,
          y: ball.velocity.y + Math.sin(radians) * PHYSICS.fanAccel,
        });
      }
      Matter.Engine.update(engine, PHYSICS.stepMs);
      steps += 1;
      if (portalCooldown > 0) portalCooldown -= 1;
      if (steps % PHYSICS.pathEvery === 0 && path.length < PHYSICS.pathMax) {
        path.push({ x: Math.round(ball.position.x), y: Math.round(ball.position.y) });
      }

      const events = pending;
      pending = [];
      // The collision handler may have sunk the ball during this update.
      if (currentStatus() === 'sunk') return events;
      if (ball.position.y > WORLD.height + 40) return [...events, ...finishMiss('out')];
      const speed = Matter.Vector.magnitude(ball.velocity);
      restSteps = speed < PHYSICS.restSpeed && activeFans.size === 0 ? restSteps + 1 : 0;
      if (restSteps >= PHYSICS.restSteps) return [...events, ...finishMiss('rest')];
      if (steps >= PHYSICS.maxSteps) return [...events, ...finishMiss('time')];
      return events;
    },
  };
}

/** Plays a whole shot without rendering; used by tests and the level checker. */
export function simulateShot(level: Level, drag: Point): { sunk: boolean; stars: number; steps: number } {
  const sim = createSim(level);
  sim.launch(drag);
  let steps = 0;
  while (sim.status === 'flying') {
    sim.step();
    steps += 1;
  }
  return { sunk: sim.status === 'sunk', stars: sim.stars, steps };
}
