import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Level, Point } from '../../shared/level';
import { WORLD } from '../../shared/level';
import { PHYSICS } from '../../shared/sim';
import { seeded } from './sketch';

type SketchButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: 'ink' | 'paper';
};

/** A button with a hand-drawn pen outline instead of a filled pill. */
export function SketchButton({ children, tone = 'paper', className = '', ...rest }: SketchButtonProps) {
  const isInk = tone === 'ink';
  return (
    <button
      type="button"
      {...rest}
      className={`relative h-12 px-5 font-display text-xl transition-transform active:translate-y-px disabled:opacity-40 ${
        isInk ? 'text-felt' : 'text-ink'
      } ${className}`}
    >
      <svg aria-hidden="true" className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 200 48">
        <path
          d="M4 7 C 50 3, 140 5, 196 4 C 198 18, 197 32, 195 44 C 140 46, 60 45, 5 45 C 3 32, 4 18, 4 7 Z"
          className={isInk ? 'fill-ink' : 'fill-felt'}
        />
        <path
          d="M5 5 C 60 2, 150 6, 197 5 M196 3 C 199 20, 196 34, 196 45 M197 44 C 130 47, 70 44, 4 46 M6 46 C 2 30, 5 16, 3 6"
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          className={isInk ? 'stroke-felt/60' : 'stroke-ink'}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span className="relative">{children}</span>
    </button>
  );
}

type SketchLinkProps = ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode };

/** A small hand-written link with a scribbled underline. */
export function SketchLink({ children, className = '', ...rest }: SketchLinkProps) {
  return (
    <button type="button" {...rest} className={`group relative font-display text-lg leading-none text-ink ${className}`}>
      <span>{children}</span>
      <svg aria-hidden="true" viewBox="0 0 100 6" preserveAspectRatio="none" className="absolute -bottom-1 left-0 h-1.5 w-full">
        <path d="M1 4 C 25 1, 50 5, 75 2 S 95 3, 99 3" fill="none" strokeWidth="1.6" strokeLinecap="round" className="stroke-ink/50 group-hover:stroke-coral" vectorEffect="non-scaling-stroke" />
      </svg>
    </button>
  );
}

type SketchChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  isSelected: boolean;
};

/** A doodled tool tile; the selected one is circled in red pen. */
export function SketchChip({ children, isSelected, className = '', ...rest }: SketchChipProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`relative flex h-14 w-14 flex-col items-center justify-center gap-0.5 font-display text-[0.72rem] leading-none text-ink ${className}`}
    >
      <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-0 h-full w-full overflow-visible">
        <path
          d="M6 8 C 20 4, 38 6, 50 5 C 53 20, 52 36, 51 50 C 36 53, 20 51, 5 51 C 3 36, 5 20, 6 8 Z"
          fill="none"
          strokeLinecap="round"
          strokeWidth={isSelected ? 2.6 : 1.4}
          className={isSelected ? 'stroke-coral' : 'stroke-ink/35'}
        />
      </svg>
      <span className="relative flex flex-col items-center gap-0.5">{children}</span>
    </button>
  );
}

/** Doodle icons for the level editor tools. */
export function ToolIcon({ tool }: { tool: string }) {
  const common = { fill: 'none', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className: 'stroke-ink' };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6">
      {tool === 'shelf' && (
        <g {...common}>
          <path d="M3 15 L21 9" />
          <path d="M3 18 L21 12" />
          <path d="M7 16 L9 11 M12 15 L14 10 M17 13 L19 9" strokeWidth={1.2} />
        </g>
      )}
      {tool === 'bumper' && (
        <g {...common}>
          <path d="M12 4 C 17 4, 20 8, 20 12 C 20 17, 16 20, 12 20 C 7 20, 4 16, 4 12 C 4 7, 8 4, 12 5" />
          <path d="M9 12 C 10 10, 14 10, 15 12" strokeWidth={1.4} />
        </g>
      )}
      {tool === 'star' && <path d="M12 3 L14.5 9.5 L21 10 L16 14 L17.5 21 L12 17 L6.5 21 L8 14 L3 10 L9.5 9.5 Z" fill="none" strokeWidth={2} className="stroke-coral" strokeLinejoin="round" />}
      {tool === 'fan' && (
        <g {...common}>
          <path d="M4 8 C 7 6, 9 10, 12 8 S 17 6, 20 8" />
          <path d="M4 13 C 7 11, 9 15, 12 13 S 17 11, 20 13" />
          <path d="M4 18 C 7 16, 9 20, 12 18 S 17 16, 20 18" />
        </g>
      )}
      {tool === 'vent' && (
        <g {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M8 9 H16 M7 12 H17 M8 15 H16" strokeWidth={1.4} />
        </g>
      )}
      {tool === 'ball' && <circle cx="12" cy="12" r="6" className="fill-coral stroke-ink" strokeWidth={2} />}
      {tool === 'bin' && (
        <g {...common}>
          <path d="M5 7 H19 L17 20 H7 Z" />
          <path d="M10 9 L10.5 18 M14 9 L13.5 18" strokeWidth={1.2} />
        </g>
      )}
      {tool === 'erase' && (
        <g {...common}>
          <path d="M5 16 L13 6 L19 11 L12 20 H7 Z" />
          <path d="M9 11 L15 16" strokeWidth={1.4} />
        </g>
      )}
      {tool === 'move' && (
        <g {...common}>
          <path d="M12 3 V21 M3 12 H21" strokeWidth={1.6} />
          <path d="M9 6 L12 3 L15 6 M9 18 L12 21 L15 18 M6 9 L3 12 L6 15 M18 9 L21 12 L18 15" />
        </g>
      )}
      {tool === 'undo' && (
        <g {...common}>
          <path d="M9 7 L4 11 L9 15" />
          <path d="M4 11 H14 C 18 11, 20 14, 20 17" />
        </g>
      )}
    </svg>
  );
}

/** A scribbled underline for hand-written headings. */
export function Scribble({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className={`h-3 w-full ${className}`}>
      <path d="M2 8 C 40 3, 80 10, 120 6 S 180 4, 198 7" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-coral" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Hand-drawn SVG paths, seeded so they hold still between renders.

function wobblyPath(points: Point[], rand: () => number, wobble: number, closed: boolean): string {
  const all = closed ? [...points, points[0] ?? { x: 0, y: 0 }] : points;
  let d = '';
  for (let pass = 0; pass < 2; pass += 1) {
    all.forEach((p, i) => {
      const next = all[i + 1];
      if (!next) return;
      const steps = Math.max(1, Math.round(Math.hypot(next.x - p.x, next.y - p.y) / 18));
      for (let s = 0; s <= steps; s += 1) {
        const t = s / steps;
        const x = (p.x + (next.x - p.x) * t + (rand() - 0.5) * wobble).toFixed(1);
        const y = (p.y + (next.y - p.y) * t + (rand() - 0.5) * wobble).toFixed(1);
        d += i === 0 && s === 0 ? `M${x} ${y}` : ` L${x} ${y}`;
      }
    });
  }
  return d;
}

function rectPoints(x: number, y: number, w: number, h: number, angle: number): Point[] {
  const r = (angle * Math.PI) / 180;
  return [
    [-w / 2, -h / 2],
    [w / 2, -h / 2],
    [w / 2, h / 2],
    [-w / 2, h / 2],
  ].map(([dx = 0, dy = 0]) => ({ x: x + dx * Math.cos(r) - dy * Math.sin(r), y: y + dx * Math.sin(r) + dy * Math.cos(r) }));
}

function circlePoints(cx: number, cy: number, r: number): Point[] {
  const count = Math.max(10, Math.round(r));
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

const HATCH_ID = 'crumple-hatch';

/** A hand-drawn drawing of a level: the feed preview and the editor canvas. */
export function LevelSketch({ level, className = '', withPaper = false }: { level: Level; className?: string; withPaper?: boolean }) {
  const rand = seeded(level.walls.length * 97 + level.stars.length * 13 + 5);
  const { cup } = level;
  const half = PHYSICS.cupInner / 2 + 6;
  const top = cup.y - PHYSICS.cupDepth / 2 - 2;
  const bottom = cup.y + PHYSICS.cupDepth / 2 + 6;
  const bin = [
    { x: cup.x - half - 3, y: top },
    { x: cup.x + half + 3, y: top },
    { x: cup.x + half - 1, y: bottom },
    { x: cup.x - half + 1, y: bottom },
  ];
  const stroke = { fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style: { vectorEffect: 'non-scaling-stroke' as const } };
  return (
    <svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} className={className} role="img" aria-label={`Drawing of ${level.name || 'a level'}`}>
      <defs>
        <pattern id={HATCH_ID} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="7" className="stroke-ink" strokeWidth="1.4" />
        </pattern>
      </defs>
      {withPaper && (
        <g>
          {Array.from({ length: Math.floor(WORLD.height / 24) - 1 }, (_, i) => (
            <line key={i} x1="0" x2={WORLD.width} y1={48 + i * 24} y2={48 + i * 24} className="stroke-[#d4e2f3]" />
          ))}
          <line x1="26" x2="26" y1="0" y2={WORLD.height} className="stroke-[#f3c6c0]" strokeWidth="1.5" />
        </g>
      )}
      {level.fans.map((f, i) => (
        <path key={`f${i}`} d={wobblyPath(rectPoints(f.x, f.y, f.w, f.h, 0), rand, 2, true)} {...stroke} className="stroke-ink/50" strokeWidth="1.4" strokeDasharray="8 7" />
      ))}
      {level.walls.map((w, i) => {
        const pts = rectPoints(w.x, w.y, w.w, w.h, w.angle);
        return (
          <g key={`w${i}`}>
            <polygon points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill={`url(#${HATCH_ID})`} />
            <path d={wobblyPath(pts, rand, 2.2, true)} {...stroke} className="stroke-ink" strokeWidth="1.8" />
          </g>
        );
      })}
      {level.bumpers.map((b, i) => (
        <g key={`b${i}`}>
          <path d={wobblyPath(circlePoints(b.x, b.y, b.r), rand, 1.6, true)} {...stroke} className="stroke-ink" strokeWidth="2" />
          <path d={wobblyPath(circlePoints(b.x, b.y, b.r * 0.45), rand, 1, true)} {...stroke} className="stroke-ink/70" strokeWidth="1.3" />
        </g>
      ))}
      {level.portals.flatMap((p, i) =>
        [p.a, p.b].map((end, j) => (
          <g key={`p${i}${j}`}>
            <circle cx={end.x} cy={end.y} r={PHYSICS.portalRadius} className="fill-ink" />
            {[-5, 0, 5].map((dy) => (
              <line key={dy} x1={end.x - 9} x2={end.x + 9} y1={end.y + dy} y2={end.y + dy} className="stroke-felt" strokeWidth="1.5" />
            ))}
          </g>
        ))
      )}
      <polygon points={bin.map((p) => `${p.x},${p.y}`).join(' ')} className="fill-felt" />
      <path d={wobblyPath(bin, rand, 1.6, true)} {...stroke} className="stroke-ink" strokeWidth="2" />
      {[0.33, 0.66].map((t) => (
        <line key={t} x1={bin[0]!.x + (bin[1]!.x - bin[0]!.x) * t} y1={top + 4} x2={bin[3]!.x + (bin[2]!.x - bin[3]!.x) * t} y2={bottom - 3} className="stroke-ink/60" strokeWidth="1.2" />
      ))}
      {level.stars.map((s, i) => {
        const pts = Array.from({ length: 10 }, (_, k) => {
          const radius = k % 2 === 0 ? 12 : 5.5;
          const a = -Math.PI / 2 + (k * Math.PI) / 5;
          return { x: s.x + Math.cos(a) * radius, y: s.y + Math.sin(a) * radius };
        });
        return <path key={`s${i}`} d={wobblyPath(pts, rand, 1, true)} {...stroke} className="stroke-coral" strokeWidth="2" />;
      })}
      <circle cx={level.ball.x} cy={level.ball.y} r={PHYSICS.ballRadius + 3} className="fill-coral stroke-ink" strokeWidth="2" style={{ vectorEffect: 'non-scaling-stroke' }} />
    </svg>
  );
}
