import Phaser from 'phaser';
import type { Level, Point } from '../../shared/level';
import { WORLD } from '../../shared/level';
import { createSim, gravityPerStep, launchVelocity, PHYSICS, previewArc, usableLeftovers } from '../../shared/sim';
import type { Sim, SimEvent } from '../../shared/sim';
import { COLORS } from './theme';

export type ShotResult = { sunk: boolean; stars: number; path: Point[]; rest: Point | null };

export type SceneData = {
  level: Level;
  ghosts: Point[][];
  /** Missed balls from earlier shots; they stay on the table as obstacles. */
  leftovers: Point[];
  onLaunch: () => void;
  onResult: (result: ShotResult) => void;
};

const MIN_DRAG = 10;
const TRAIL_LENGTH = 14;
const MAX_STEPS_PER_FRAME = 5;

function starPoints(x: number, y: number, outer: number, inner: number): Phaser.Math.Vector2[] {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return new Phaser.Math.Vector2(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
  });
}

export class PlayScene extends Phaser.Scene {
  private sim!: Sim;
  private setup!: SceneData;
  private ball!: Phaser.GameObjects.Arc;
  private aim!: Phaser.GameObjects.Graphics;
  private trail!: Phaser.GameObjects.Graphics;
  private fanArrows!: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Graphics[] = [];
  private bumpers: Phaser.GameObjects.Arc[] = [];
  private dragStart: Point | null = null;
  private dragNow: Point | null = null;
  private trailPoints: Point[] = [];
  private accumulator = 0;
  private fanOffset = 0;
  private finished = false;

  constructor() {
    super('play');
  }

  init(data: SceneData) {
    this.setup = data;
    this.sim = createSim(data.level, data.leftovers);
    this.stars = [];
    this.bumpers = [];
    this.trailPoints = [];
    this.accumulator = 0;
    this.finished = false;
    this.dragStart = null;
    this.dragNow = null;
  }

  create() {
    this.makeTextures();
    this.drawBackground();
    this.drawGhosts();
    this.drawLevel();
    this.drawLeftovers();

    this.trail = this.add.graphics();
    this.aim = this.add.graphics();
    const { ball } = this.setup.level;
    this.ball = this.add.circle(ball.x, ball.y, PHYSICS.ballRadius, COLORS.coral).setStrokeStyle(2.5, COLORS.ink);
    this.tweens.add({ targets: this.ball, scale: 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.sim.status !== 'aiming') return;
      this.dragStart = { x: pointer.worldX, y: pointer.worldY };
      this.dragNow = this.dragStart;
    });
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.dragStart) this.dragNow = { x: pointer.worldX, y: pointer.worldY };
    });
    this.input.on('pointerup', () => this.release());
    this.input.on('pointerupoutside', () => this.release());
  }

  private makeTextures() {
    if (this.textures.exists('spark')) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(COLORS.white).fillCircle(4, 4, 4).generateTexture('spark', 8, 8).clear();
    g.fillStyle(COLORS.white).fillRect(0, 0, 6, 10).generateTexture('confetti', 6, 10).destroy();
  }

  private drawBackground() {
    const g = this.add.graphics();
    g.lineStyle(1, COLORS.feltLine, 1);
    for (let x = 30; x < WORLD.width; x += 30) g.lineBetween(x, 0, x, WORLD.height);
    for (let y = 30; y < WORLD.height; y += 30) g.lineBetween(0, y, WORLD.width, y);
  }

  private drawGhosts() {
    if (this.setup.ghosts.length === 0) return;
    const g = this.add.graphics();
    g.lineStyle(2, COLORS.ink, 0.09);
    for (const path of this.setup.ghosts) {
      const first = path[0];
      if (!first) continue;
      g.beginPath();
      g.moveTo(first.x, first.y);
      for (const point of path.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
    }
  }

  private drawLeftovers() {
    const leftovers = usableLeftovers(this.setup.level, this.setup.leftovers);
    leftovers.forEach((point, index) => {
      const isNewest = index === leftovers.length - 1;
      const ball = this.add
        .circle(point.x, point.y, PHYSICS.ballRadius, COLORS.felt)
        .setStrokeStyle(2.5, COLORS.inkSoft);
      this.add
        .text(point.x, point.y + 0.5, String(index + 1), {
          fontFamily: 'Bricolage Grotesque Variable, system-ui, sans-serif',
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#5d7d73',
        })
        .setOrigin(0.5);
      if (isNewest) {
        // The ball you just missed with settles into place.
        ball.setScale(1.4);
        this.tweens.add({ targets: ball, scale: 1, duration: 260, ease: 'Back.easeOut' });
      }
    });
  }

  private drawLevel() {
    const { level } = this.setup;

    for (const fan of level.fans) {
      this.add.rectangle(fan.x, fan.y, fan.w, fan.h, COLORS.ink, 0.06).setStrokeStyle(1.5, COLORS.ink, 0.25);
    }
    this.fanArrows = this.add.graphics();

    for (const wall of level.walls) {
      this.add
        .rectangle(wall.x, wall.y, wall.w, wall.h, COLORS.ink)
        .setRotation(Phaser.Math.DegToRad(wall.angle));
    }

    for (const bumper of level.bumpers) {
      this.add.circle(bumper.x, bumper.y, bumper.r, COLORS.felt).setStrokeStyle(4, COLORS.ink);
      this.bumpers.push(this.add.circle(bumper.x, bumper.y, bumper.r * 0.45, COLORS.ink));
    }

    for (const portal of level.portals) {
      for (const end of [portal.a, portal.b]) {
        const ring = this.add.circle(end.x, end.y, PHYSICS.portalRadius, COLORS.felt, 0).setStrokeStyle(3, COLORS.ink);
        const inner = this.add.circle(end.x, end.y, PHYSICS.portalRadius * 0.55, COLORS.ink, 0.85);
        this.tweens.add({ targets: [ring, inner], scale: 0.85, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    }

    level.stars.forEach((star) => {
      const g = this.add.graphics({ x: star.x, y: star.y });
      g.fillStyle(COLORS.coral).fillPoints(starPoints(0, 0, 11, 5), true);
      g.lineStyle(2, COLORS.ink).strokePoints(starPoints(0, 0, 11, 5), true);
      this.tweens.add({ targets: g, angle: 12, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.stars.push(g);
    });

    const { cup } = level;
    const half = PHYSICS.cupInner / 2;
    const depth = PHYSICS.cupDepth;
    const g = this.add.graphics();
    g.fillStyle(COLORS.ink);
    g.fillRect(cup.x - half - 6, cup.y - depth / 2, 6, depth);
    g.fillRect(cup.x + half, cup.y - depth / 2, 6, depth);
    g.fillRect(cup.x - half - 6, cup.y + depth / 2, PHYSICS.cupInner + 12, 6);
    g.lineStyle(2, COLORS.ink).lineBetween(cup.x + half + 3, cup.y - depth / 2, cup.x + half + 3, cup.y - depth / 2 - 34);
    g.fillStyle(COLORS.coral).fillTriangle(
      cup.x + half + 4,
      cup.y - depth / 2 - 34,
      cup.x + half + 24,
      cup.y - depth / 2 - 27,
      cup.x + half + 4,
      cup.y - depth / 2 - 20
    );
  }

  private release() {
    const start = this.dragStart;
    const now = this.dragNow;
    this.dragStart = null;
    this.dragNow = null;
    this.aim.clear();
    if (!start || !now || this.sim.status !== 'aiming') return;
    const drag = { x: now.x - start.x, y: now.y - start.y };
    if (Math.hypot(drag.x, drag.y) < MIN_DRAG) return;
    this.tweens.killTweensOf(this.ball);
    this.ball.setScale(1);
    this.sim.launch(drag);
    this.setup.onLaunch();
  }

  private drawAim() {
    this.aim.clear();
    if (!this.dragStart || !this.dragNow) return;
    const drag = { x: this.dragNow.x - this.dragStart.x, y: this.dragNow.y - this.dragStart.y };
    const length = Math.hypot(drag.x, drag.y);
    if (length < MIN_DRAG) return;
    const power = Math.min(length, PHYSICS.fullPowerDrag) / PHYSICS.fullPowerDrag;
    const from = { x: this.ball.x, y: this.ball.y };

    // Rubber band toward the pull, power ring around the ball.
    const pull = Math.min(length, PHYSICS.fullPowerDrag) * 0.45;
    this.aim.lineStyle(3, COLORS.ink, 0.5);
    this.aim.lineBetween(from.x, from.y, from.x + (drag.x / length) * pull, from.y + (drag.y / length) * pull);
    this.aim.lineStyle(4, COLORS.coral, 1);
    this.aim.beginPath();
    this.aim.arc(from.x, from.y, PHYSICS.ballRadius + 8, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
    this.aim.strokePath();

    const arc = previewArc(from, launchVelocity(drag), gravityPerStep(this.sim.engine));
    arc.forEach((point, index) => {
      this.aim.fillStyle(COLORS.ink, 0.55 * (1 - index / arc.length));
      this.aim.fillCircle(point.x, point.y, 3 - (index / arc.length) * 1.5);
    });
  }

  private burst(x: number, y: number, texture: string, tint: number, count: number, speed = 160) {
    const emitter = this.add.particles(x, y, texture, {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      scale: { start: 1, end: 0 },
      lifespan: 600,
      gravityY: 300,
      tint,
      emitting: false,
    });
    emitter.explode(count);
    this.time.delayedCall(900, () => emitter.destroy());
  }

  private handle(event: SimEvent) {
    const { x, y } = this.ball;
    switch (event.type) {
      case 'star': {
        const star = this.stars[event.index];
        if (star) {
          this.tweens.killTweensOf(star);
          this.tweens.add({ targets: star, scale: 1.8, alpha: 0, duration: 260, ease: 'Back.easeOut' });
        }
        this.burst(x, y, 'spark', COLORS.coral, 14);
        break;
      }
      case 'bump': {
        const bumper = this.bumpers.find((b) => Phaser.Math.Distance.Between(b.x, b.y, x, y) < 60);
        if (bumper) this.tweens.add({ targets: bumper, scale: 1.6, duration: 90, yoyo: true });
        this.cameras.main.shake(90, 0.006);
        break;
      }
      case 'portal':
        this.cameras.main.flash(120, 18, 48, 42);
        this.trailPoints = [];
        break;
      case 'hit':
        if (event.speed > 3) {
          this.tweens.add({ targets: this.ball, scaleX: 1.25, scaleY: 0.8, duration: 60, yoyo: true });
        }
        break;
      case 'cup':
        this.burst(this.setup.level.cup.x, this.setup.level.cup.y - 10, 'confetti', COLORS.coral, 40, 320);
        this.burst(this.setup.level.cup.x, this.setup.level.cup.y - 10, 'confetti', COLORS.ink, 20, 280);
        this.cameras.main.shake(160, 0.008);
        this.finish(true);
        break;
      case 'miss':
        this.tweens.add({ targets: this.ball, alpha: 0.25, duration: 300 });
        this.finish(false);
        break;
    }
  }

  private finish(sunk: boolean) {
    if (this.finished) return;
    this.finished = true;
    const result = { sunk, stars: this.sim.stars, path: this.sim.path(), rest: this.sim.restPoint() };
    this.time.delayedCall(sunk ? 700 : 350, () => this.setup.onResult(result));
  }

  override update(_time: number, delta: number) {
    this.fanOffset = (this.fanOffset + delta * 0.04) % 20;
    this.drawFans();

    if (this.sim.status === 'aiming') {
      this.drawAim();
      return;
    }
    if (this.sim.status !== 'flying') return;

    this.accumulator += Math.min(delta, 100);
    let steps = 0;
    while (this.accumulator >= PHYSICS.stepMs && steps < MAX_STEPS_PER_FRAME && this.sim.status === 'flying') {
      for (const event of this.sim.step()) this.handle(event);
      this.accumulator -= PHYSICS.stepMs;
      steps += 1;
    }
    const { position } = this.sim.ball;
    this.ball.setPosition(position.x, position.y);
    this.trailPoints = [...this.trailPoints, { x: position.x, y: position.y }].slice(-TRAIL_LENGTH);
    this.drawTrail();
  }

  private drawTrail() {
    this.trail.clear();
    this.trailPoints.forEach((point, index) => {
      const t = (index + 1) / this.trailPoints.length;
      this.trail.fillStyle(COLORS.coral, 0.35 * t);
      this.trail.fillCircle(point.x, point.y, PHYSICS.ballRadius * t * 0.8);
    });
  }

  private drawFans() {
    const g = this.fanArrows;
    g.clear();
    g.lineStyle(2, COLORS.ink, 0.35);
    for (const fan of this.setup.level.fans) {
      const radians = Phaser.Math.DegToRad(fan.angle);
      const dx = Math.cos(radians);
      const dy = Math.sin(radians);
      for (let col = -1; col <= 1; col += 1) {
        for (let k = -4; k <= 4; k += 1) {
          const along = k * 20 + this.fanOffset;
          const cx = fan.x + dx * along - dy * col * (fan.w / 3.2);
          const cy = fan.y + dy * along + dx * col * (fan.w / 3.2);
          if (Math.abs(cx - fan.x) > fan.w / 2 - 6 || Math.abs(cy - fan.y) > fan.h / 2 - 6) continue;
          // Chevron pointing along the push direction.
          g.lineBetween(cx - dx * 4 - dy * 5, cy - dy * 4 + dx * 5, cx + dx * 3, cy + dy * 3);
          g.lineBetween(cx - dx * 4 + dy * 5, cy - dy * 4 - dx * 5, cx + dx * 3, cy + dy * 3);
        }
      }
    }
  }
}

export function createGame(parent: HTMLElement, data: SceneData): Phaser.Game {
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD.width,
    height: WORLD.height,
    backgroundColor: COLORS.felt,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
    banner: false,
  });
  game.scene.add('play', PlayScene, true, data);
  return game;
}
