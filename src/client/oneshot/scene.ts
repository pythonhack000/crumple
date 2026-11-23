import Phaser from 'phaser';
import type { PileBall } from '../../shared/api';
import type { Level, Point } from '../../shared/level';
import { WORLD } from '../../shared/level';
import { createSim, gravityPerStep, launchVelocity, PHYSICS, previewArc, usableLeftovers } from '../../shared/sim';
import type { Sim, SimEvent } from '../../shared/sim';
import { paperBall, penBlock, penCircle, penLine, penStar, rectCorners, seeded } from './sketch';
import { sfx, unlock } from './audio';
import { COLORS } from './theme';

export type ShotResult = { sunk: boolean; stars: number; path: Point[]; rest: Point | null };

export type SceneData = {
  level: Level;
  ghosts: Point[][];
  /** Everyone's missed balls on the shared table; they are solid. */
  pile: PileBall[];
  /** Decoded drawn balls by username. */
  arts: Record<string, HTMLImageElement>;
  /** The viewer, whose drawn ball is the one being thrown. */
  username: string | undefined;
  onLaunch: () => void;
  onResult: (result: ShotResult) => void;
};

const MIN_DRAG = 10;
const TRAIL_LENGTH = 12;
const MAX_STEPS_PER_FRAME = 5;
const RULE_GAP = 24;
const MARGIN_X = 26;
const DRAW_IN_DELAY = 80;
const DRAW_IN_STAGGER = 45;

export class PlayScene extends Phaser.Scene {
  private sim!: Sim;
  private setup!: SceneData;
  private ball!: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
  private aim!: Phaser.GameObjects.Graphics;
  private trail!: Phaser.GameObjects.Graphics;
  private wind!: Phaser.GameObjects.Graphics;
  private stars: Phaser.GameObjects.Graphics[] = [];
  private bumpers: Phaser.GameObjects.Graphics[] = [];
  private dragStart: Point | null = null;
  private dragNow: Point | null = null;
  private trailPoints: Point[] = [];
  private accumulator = 0;
  private windOffset = 0;
  private finished = false;
  private ballScale = 1;

  constructor() {
    super('play');
  }

  init(data: SceneData) {
    this.setup = data;
    this.sim = createSim(data.level, data.pile);
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
    this.drawPaper();
    this.drawGhosts();
    const before = this.children.list.length;
    this.drawLevel();
    this.drawPile();
    this.drawIn(this.children.list.slice(before));

    this.trail = this.add.graphics();
    this.aim = this.add.graphics();
    const { ball } = this.setup.level;
    const myArt = this.artKey(this.setup.username);
    if (myArt) {
      this.ball = this.add.image(ball.x, ball.y, myArt).setDisplaySize((PHYSICS.ballRadius + 3) * 2, (PHYSICS.ballRadius + 3) * 2);
    } else {
      const paper = this.add.graphics({ x: ball.x, y: ball.y });
      paperBall(paper, PHYSICS.ballRadius + 2, seeded(7), COLORS.coral, COLORS.ink);
      this.ball = paper;
    }
    this.ballScale = this.ball.scale;
    this.tweens.add({ targets: this.ball, scale: this.ballScale * 1.1, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      unlock();
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

  /** Sketches the level in, piece by piece, as if someone is drawing it now. */
  private drawIn(objects: Phaser.GameObjects.GameObject[]) {
    objects.forEach((object, index) => {
      if (!(object instanceof Phaser.GameObjects.Graphics) && !(object instanceof Phaser.GameObjects.Image)) return;
      const scale = object.scale;
      object.setAlpha(0).setScale(scale * 0.92);
      this.tweens.add({
        targets: object,
        alpha: 1,
        scale,
        delay: DRAW_IN_DELAY + index * DRAW_IN_STAGGER,
        duration: 180,
        ease: 'Quad.easeOut',
      });
    });
  }

  /** Texture key for a player's drawn ball, registering it on first use. */
  private artKey(username: string | undefined): string | null {
    if (!username) return null;
    const image = this.setup.arts[username];
    if (!image) return null;
    const key = `art:${username}:${image.src.length}`;
    if (!this.textures.exists(key)) this.textures.addImage(key, image);
    return key;
  }

  private makeTextures() {
    if (this.textures.exists('scrap')) return;
    const g = this.make.graphics({}, false);
    g.fillStyle(COLORS.white).fillRect(0, 0, 7, 5).lineStyle(1, COLORS.ink).strokeRect(0, 0, 7, 5);
    g.generateTexture('scrap', 7, 5).clear();
    g.fillStyle(COLORS.white).fillCircle(3, 3, 3).generateTexture('dot', 6, 6).destroy();
  }

  /** Lined notebook paper with a margin. */
  private drawPaper() {
    const g = this.add.graphics();
    g.lineStyle(1, COLORS.rule, 1);
    for (let y = RULE_GAP * 2; y < WORLD.height; y += RULE_GAP) g.lineBetween(0, y, WORLD.width, y);
    g.lineStyle(1.5, COLORS.margin, 1).lineBetween(MARGIN_X, 0, MARGIN_X, WORLD.height);
  }

  /** Other players' sinking paths, as faint pencil lines. */
  private drawGhosts() {
    if (this.setup.ghosts.length === 0) return;
    const g = this.add.graphics();
    g.lineStyle(1.5, COLORS.ink, 0.12);
    for (const path of this.setup.ghosts) {
      const first = path[0];
      if (!first) continue;
      g.beginPath();
      g.moveTo(first.x, first.y);
      for (const point of path.slice(1)) g.lineTo(point.x, point.y);
      g.strokePath();
    }
  }

  private drawLevel() {
    const { level } = this.setup;
    const rand = seeded(level.name.length * 131 + level.walls.length);

    // Fans: a dashed draught zone; the moving squiggles are drawn every frame.
    const fans = this.add.graphics();
    fans.lineStyle(1.2, COLORS.inkSoft, 0.8);
    for (const fan of level.fans) {
      const corners = rectCorners(fan.x, fan.y, fan.w, fan.h, 0);
      corners.forEach((corner, i) => {
        const next = corners[(i + 1) % 4] ?? corner;
        const steps = Math.round(Math.hypot(next.x - corner.x, next.y - corner.y) / 10);
        for (let s = 0; s < steps; s += 2) {
          const a = s / steps;
          const b = Math.min(1, (s + 1) / steps);
          fans.lineBetween(corner.x + (next.x - corner.x) * a, corner.y + (next.y - corner.y) * a, corner.x + (next.x - corner.x) * b, corner.y + (next.y - corner.y) * b);
        }
      });
    }
    this.wind = this.add.graphics();

    // Walls: shelves and desks, outlined and hatched.
    const walls = this.add.graphics();
    walls.fillStyle(COLORS.paper, 1);
    walls.lineStyle(1.6, COLORS.ink, 1);
    for (const wall of level.walls) {
      const corners = rectCorners(wall.x, wall.y, wall.w, wall.h, wall.angle);
      walls.fillPoints(corners as Phaser.Math.Vector2[], true);
      penBlock(walls, corners, rand);
    }

    // Bumpers: stress balls with a squiggle.
    for (const bumper of level.bumpers) {
      const g = this.add.graphics({ x: bumper.x, y: bumper.y });
      g.fillStyle(COLORS.paper, 1).fillCircle(0, 0, bumper.r);
      g.lineStyle(2, COLORS.ink, 1);
      penCircle(g, 0, 0, bumper.r, rand);
      g.lineStyle(1.3, COLORS.ink, 0.8);
      penCircle(g, 0, 0, bumper.r * 0.45, rand, 1);
      this.bumpers.push(g);
    }

    // Portals: two air vents linked by the same number of slats.
    level.portals.forEach((portal) => {
      for (const end of [portal.a, portal.b]) {
        const g = this.add.graphics({ x: end.x, y: end.y });
        g.fillStyle(COLORS.ink, 0.9).fillCircle(0, 0, PHYSICS.portalRadius);
        g.lineStyle(1.5, COLORS.paper, 0.9);
        for (let i = -2; i <= 2; i += 1) g.lineBetween(-10, i * 5, 10, i * 5);
        g.lineStyle(1.6, COLORS.ink, 1);
        penCircle(g, 0, 0, PHYSICS.portalRadius + 3, rand, 1);
        this.tweens.add({ targets: g, angle: 360, duration: 6000, repeat: -1 });
      }
    });

    // Stars: coral doodles that wiggle a little.
    level.stars.forEach((star) => {
      const g = this.add.graphics({ x: star.x, y: star.y });
      g.lineStyle(2, COLORS.coral, 1);
      penStar(g, 0, 0, 11, rand);
      this.tweens.add({ targets: g, angle: 10, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.stars.push(g);
    });

    this.drawBin(rand);
  }

  /** The wastebasket around the cup: a striped bin, slightly wider at the top. */
  private drawBin(rand: () => number) {
    const { cup } = this.setup.level;
    const half = PHYSICS.cupInner / 2 + 6;
    const top = cup.y - PHYSICS.cupDepth / 2 - 2;
    const bottom = cup.y + PHYSICS.cupDepth / 2 + 6;
    const g = this.add.graphics();
    const outline = [
      { x: cup.x - half - 3, y: top },
      { x: cup.x + half + 3, y: top },
      { x: cup.x + half - 1, y: bottom },
      { x: cup.x - half + 1, y: bottom },
    ];
    g.fillStyle(COLORS.paper, 1).fillPoints(outline as Phaser.Math.Vector2[], true);
    g.lineStyle(1.8, COLORS.ink, 1);
    outline.forEach((p, i) => penLine(g, p, outline[(i + 1) % 4] ?? p, rand, 0.8));
    g.lineStyle(1.2, COLORS.ink, 0.6);
    for (let i = 1; i < 5; i += 1) {
      const t = i / 5;
      penLine(g, { x: cup.x - half - 3 + (half * 2 + 6) * t, y: top + 3 }, { x: cup.x - half + 1 + (half * 2 - 2) * t, y: bottom - 2 }, rand, 0.5);
    }
    // Rim and a coral tag so the target reads at a glance.
    g.lineStyle(2.4, COLORS.ink, 1);
    penLine(g, { x: cup.x - half - 6, y: top }, { x: cup.x + half + 6, y: top }, rand, 0.6);
    g.fillStyle(COLORS.coral, 1).fillCircle(cup.x, bottom - 9, 4);
  }

  /** Everyone's missed balls; yours are drawn in darker ink. */
  private drawPile() {
    const pile = usableLeftovers(this.setup.level, this.setup.pile);
    pile.forEach((ball, index) => {
      const art = this.artKey(ball.owner);
      let g: Phaser.GameObjects.Graphics | Phaser.GameObjects.Image;
      if (art) {
        g = this.add.image(ball.x, ball.y, art).setDisplaySize(PHYSICS.ballRadius * 2, PHYSICS.ballRadius * 2);
        g.setAlpha(ball.mine ? 1 : 0.85);
      } else {
        const paper = this.add.graphics({ x: ball.x, y: ball.y });
        paperBall(paper, PHYSICS.ballRadius, seeded(index + 11), COLORS.paper, ball.mine ? COLORS.ink : COLORS.inkSoft, ball.mine ? 1 : 0.8);
        g = paper;
      }
      g.angle = (index * 47) % 360;
      if (ball.mine && index === pile.length - 1) {
        // The ball you just missed with settles into place.
        const settled = g.scale;
        g.setScale(settled * 1.4);
        this.tweens.add({ targets: g, scale: settled, duration: 260, ease: 'Back.easeOut' });
      }
    });
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
    this.ball.setScale(this.ballScale);
    this.sim.launch(drag);
    sfx.launch();
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

    // Rubber band toward the pull, power arc around the ball.
    const pull = Math.min(length, PHYSICS.fullPowerDrag) * 0.45;
    this.aim.lineStyle(2, COLORS.ink, 0.5);
    this.aim.lineBetween(from.x, from.y, from.x + (drag.x / length) * pull, from.y + (drag.y / length) * pull);
    this.aim.lineStyle(3.5, COLORS.coral, 1);
    this.aim.beginPath();
    this.aim.arc(from.x, from.y, PHYSICS.ballRadius + 8, -Math.PI / 2, -Math.PI / 2 + power * Math.PI * 2);
    this.aim.strokePath();

    // Pencil dashes for the start of the flight.
    const arc = previewArc(from, launchVelocity(drag), gravityPerStep(this.sim.engine));
    this.aim.lineStyle(2, COLORS.ink, 0.6);
    for (let i = 0; i + 1 < arc.length; i += 2) {
      const a = arc[i];
      const b = arc[i + 1];
      if (!a || !b) continue;
      this.aim.lineStyle(2, COLORS.ink, 0.6 * (1 - i / arc.length));
      this.aim.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  private burst(x: number, y: number, texture: string, tint: number, count: number, speed = 160) {
    const emitter = this.add.particles(x, y, texture, {
      speed: { min: speed * 0.4, max: speed },
      angle: { min: 0, max: 360 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.2 },
      lifespan: 700,
      gravityY: 300,
      tint,
      emitting: false,
    });
    emitter.explode(count);
    this.time.delayedCall(1000, () => emitter.destroy());
  }

  private handle(event: SimEvent) {
    const { x, y } = this.ball;
    switch (event.type) {
      case 'star': {
        const star = this.stars[event.index];
        if (star) {
          this.tweens.killTweensOf(star);
          this.tweens.add({ targets: star, scale: 1.9, alpha: 0, duration: 260, ease: 'Back.easeOut' });
        }
        this.burst(x, y, 'dot', COLORS.coral, 12);
        sfx.star();
        break;
      }
      case 'bump': {
        const bumper = this.bumpers.find((b) => Phaser.Math.Distance.Between(b.x, b.y, x, y) < 60);
        if (bumper) this.tweens.add({ targets: bumper, scale: 1.25, duration: 90, yoyo: true });
        this.cameras.main.shake(90, 0.006);
        sfx.bump();
        break;
      }
      case 'portal':
        this.cameras.main.flash(120, 34, 64, 143);
        this.trailPoints = [];
        sfx.portal();
        break;
      case 'hit':
        if (event.speed > 3) {
          this.tweens.add({ targets: this.ball, scaleX: this.ballScale * 1.25, scaleY: this.ballScale * 0.8, duration: 60, yoyo: true });
        }
        if (event.speed > 1) sfx.hit(event.speed);
        break;
      case 'cup': {
        const { cup } = this.setup.level;
        this.burst(cup.x, cup.y - 12, 'scrap', COLORS.white, 34, 300);
        this.burst(cup.x, cup.y - 12, 'dot', COLORS.coral, 16, 260);
        this.cameras.main.shake(160, 0.008);
        this.tweens.add({ targets: this.ball, scale: this.ballScale * 0.6, alpha: 0, duration: 350, ease: 'Quad.easeIn' });
        sfx.cup();
        this.finish(true);
        break;
      }
      case 'miss':
        this.tweens.add({ targets: this.ball, alpha: 0.3, duration: 300 });
        sfx.miss();
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
    this.windOffset = (this.windOffset + delta * 0.05) % 24;
    this.drawWind();

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
    const { position, angle } = this.sim.ball;
    this.ball.setPosition(position.x, position.y);
    this.ball.setRotation(angle);
    this.trailPoints = [...this.trailPoints, { x: position.x, y: position.y }].slice(-TRAIL_LENGTH);
    this.drawTrail();
  }

  /** Speed lines behind the ball, like a comic. */
  private drawTrail() {
    this.trail.clear();
    for (let i = 1; i < this.trailPoints.length; i += 1) {
      const a = this.trailPoints[i - 1];
      const b = this.trailPoints[i];
      if (!a || !b) continue;
      this.trail.lineStyle(1.5, COLORS.ink, 0.35 * (i / this.trailPoints.length));
      this.trail.lineBetween(a.x, a.y, b.x, b.y);
    }
  }

  /** Little wind squiggles drifting in each fan's direction. */
  private drawWind() {
    const g = this.wind;
    g.clear();
    g.lineStyle(1.4, COLORS.inkSoft, 0.9);
    for (const fan of this.setup.level.fans) {
      const r = Phaser.Math.DegToRad(fan.angle);
      const dx = Math.cos(r);
      const dy = Math.sin(r);
      for (let col = -1; col <= 1; col += 1) {
        for (let k = -6; k <= 6; k += 1) {
          const along = k * 24 + this.windOffset + col * 8;
          const cx = fan.x + dx * along - dy * col * (fan.w / 3.2);
          const cy = fan.y + dy * along + dx * col * (fan.w / 3.2);
          if (Math.abs(cx - fan.x) > fan.w / 2 - 8 || Math.abs(cy - fan.y) > fan.h / 2 - 8) continue;
          // A tilde-shaped squiggle along the push direction.
          g.beginPath();
          for (let s = 0; s <= 6; s += 1) {
            const t = (s / 6 - 0.5) * 12;
            const wave = Math.sin((s / 6) * Math.PI * 2) * 2.2;
            const px = cx + dx * t - dy * wave;
            const py = cy + dy * t + dx * wave;
            if (s === 0) g.moveTo(px, py);
            else g.lineTo(px, py);
          }
          g.strokePath();
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
    backgroundColor: COLORS.paper,
    antialias: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [],
    banner: false,
  });
  game.scene.add('play', PlayScene, true, data);
  return game;
}
