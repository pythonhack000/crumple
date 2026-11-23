import type Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;
type P = { x: number; y: number };

/** Small deterministic random generator, so a doodle looks the same every frame. */
export function seeded(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jitter = (rand: () => number, amount: number) => (rand() - 0.5) * 2 * amount;

/** A wobbly pen line drawn twice, like a quick hand sketch. */
export function penLine(g: G, a: P, b: P, rand: () => number, wobble = 1.2) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  const segments = Math.max(2, Math.round(length / 14));
  for (let pass = 0; pass < 2; pass += 1) {
    g.beginPath();
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const x = a.x + (b.x - a.x) * t + jitter(rand, wobble);
      const y = a.y + (b.y - a.y) * t + jitter(rand, wobble);
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }
}

/** Corners of a rectangle centred at (x, y), rotated by `angle` degrees. */
export function rectCorners(x: number, y: number, w: number, h: number, angle: number): P[] {
  const r = (angle * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([dx = 0, dy = 0]) => ({ x: x + dx * cos - dy * sin, y: y + dx * sin + dy * cos }));
}

/** Outline plus diagonal hatching, the way people shade a solid in a notebook. */
export function penBlock(g: G, corners: P[], rand: () => number, hatchGap = 6) {
  corners.forEach((corner, i) => penLine(g, corner, corners[(i + 1) % corners.length] ?? corner, rand));
  const [a, b, , d] = corners;
  if (!a || !b || !d) return;
  const along = { x: b.x - a.x, y: b.y - a.y };
  const across = { x: d.x - a.x, y: d.y - a.y };
  const length = Math.hypot(along.x, along.y);
  const lines = Math.floor(length / hatchGap);
  g.beginPath();
  for (let i = 1; i < lines; i += 1) {
    const t = i / lines;
    const start = { x: a.x + along.x * t, y: a.y + along.y * t };
    const shift = Math.min(1, hatchGap / Math.max(length, 1)) * 1.5;
    g.moveTo(start.x + jitter(rand, 0.6), start.y + jitter(rand, 0.6));
    g.lineTo(start.x + across.x - along.x * shift + jitter(rand, 0.6), start.y + across.y - along.y * shift + jitter(rand, 0.6));
  }
  g.strokePath();
}

/** A hand-drawn circle: a slightly uneven loop that overshoots its start. */
export function penCircle(g: G, cx: number, cy: number, r: number, rand: () => number, passes = 2) {
  for (let pass = 0; pass < passes; pass += 1) {
    const start = rand() * Math.PI * 2;
    const steps = Math.max(12, Math.round(r * 1.2));
    g.beginPath();
    for (let i = 0; i <= steps + 2; i += 1) {
      const a = start + (i / steps) * Math.PI * 2;
      const rr = r + jitter(rand, Math.max(0.6, r * 0.05));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a) * rr;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }
}

/** A crumpled paper ball: lumpy outline and a few crease lines. Drawn at the origin. */
export function paperBall(g: G, r: number, rand: () => number, fill: number, ink: number, inkAlpha = 1) {
  const points: Phaser.Math.Vector2[] = [];
  const corners = 9;
  for (let i = 0; i < corners; i += 1) {
    const a = (i / corners) * Math.PI * 2;
    const rr = r * (0.88 + rand() * 0.2);
    points.push({ x: Math.cos(a) * rr, y: Math.sin(a) * rr } as Phaser.Math.Vector2);
  }
  g.fillStyle(fill, 1).fillPoints(points, true);
  g.lineStyle(1.8, ink, inkAlpha).strokePoints(points, true);
  g.lineStyle(1.1, ink, inkAlpha * 0.75);
  for (let i = 0; i < 3; i += 1) {
    const a = rand() * Math.PI * 2;
    const b = a + 1.2 + rand() * 1.5;
    g.lineBetween(Math.cos(a) * r * 0.75, Math.sin(a) * r * 0.75, Math.cos(b) * r * 0.25, Math.sin(b) * r * 0.25);
  }
}

/** A doodled five-point star. */
export function penStar(g: G, cx: number, cy: number, outer: number, rand: () => number) {
  const inner = outer * 0.45;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    return { x: cx + Math.cos(a) * radius, y: cy + Math.sin(a) * radius };
  });
  pts.forEach((p, i) => penLine(g, p, pts[(i + 1) % pts.length] ?? p, rand, 0.7));
}

/** An undrawn ball, shown as its material: smooth rubber, ribbed tin or a glass marble. */
export function materialBall(g: G, r: number, material: 'rubber' | 'tin' | 'glass', ink: number) {
  if (material === 'rubber') {
    g.fillStyle(0xf2553a, 1).fillCircle(0, 0, r);
    g.lineStyle(1.8, ink, 1).strokeCircle(0, 0, r);
    g.lineStyle(2, 0xffffff, 0.8).beginPath().arc(0, 0, r * 0.6, -2.4, -1.4).strokePath();
  } else if (material === 'tin') {
    g.fillStyle(0xb9c1cd, 1).fillCircle(0, 0, r);
    g.lineStyle(1, ink, 0.55);
    for (const y of [-r * 0.45, 0, r * 0.45]) g.lineBetween(-r * 0.85, y, r * 0.85, y);
    g.lineStyle(1.8, ink, 1).strokeCircle(0, 0, r);
  } else {
    g.fillStyle(0xcfe6f6, 0.85).fillCircle(0, 0, r);
    g.lineStyle(1.4, 0x3d7fbf, 0.9).beginPath().arc(-r * 0.1, r * 0.1, r * 0.55, 0.3, 2.6).strokePath();
    g.lineStyle(1.8, ink, 1).strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.9).fillCircle(-r * 0.35, -r * 0.4, r * 0.2);
  }
}
