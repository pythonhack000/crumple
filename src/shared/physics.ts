// Physics tuning with no engine import, so light pages (the feed preview) can use it.

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
  /** Twist tuning. */
  moonGravity: 0.45,
  bouncyRestitution: 0.92,
  glassBreakSpeed: 9,
  binSwing: 70,
  binPeriodSteps: 220,
  /** Missed balls kept on the shared table, one per player. */
  maxLeftovers: 40,
} as const;
