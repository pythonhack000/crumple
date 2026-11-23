import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { Level } from '../../shared/level';
import { WORLD } from '../../shared/level';
import { PHYSICS } from '../../shared/sim';

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
      className={`group relative h-12 px-5 font-display text-xl transition-transform active:translate-y-px disabled:opacity-40 ${
        isInk ? 'text-felt' : 'text-ink'
      } ${className}`}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 200 48"
      >
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

/** A scribbled underline for hand-written headings. */
export function Scribble({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 12" preserveAspectRatio="none" className={`h-3 w-full ${className}`}>
      <path
        d="M2 8 C 40 3, 80 10, 120 6 S 180 4, 198 7"
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className="stroke-coral"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** A small static drawing of a level, for the feed preview. */
export function LevelSketch({ level, className = '' }: { level: Level; className?: string }) {
  const { cup } = level;
  const half = PHYSICS.cupInner / 2 + 6;
  const top = cup.y - PHYSICS.cupDepth / 2 - 2;
  const bottom = cup.y + PHYSICS.cupDepth / 2 + 6;
  return (
    <svg viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} className={className} role="img" aria-label={`Sketch of ${level.name}`}>
      <g className="stroke-ink" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ vectorEffect: 'non-scaling-stroke' }}>
        {level.walls.map((w, i) => (
          <rect
            key={i}
            x={w.x - w.w / 2}
            y={w.y - w.h / 2}
            width={w.w}
            height={w.h}
            transform={`rotate(${w.angle} ${w.x} ${w.y})`}
            className="fill-ink/15"
          />
        ))}
        {level.bumpers.map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={b.r} />
        ))}
        {level.portals.flatMap((p, i) => [
          <circle key={`${i}a`} cx={p.a.x} cy={p.a.y} r={PHYSICS.portalRadius} className="fill-ink" />,
          <circle key={`${i}b`} cx={p.b.x} cy={p.b.y} r={PHYSICS.portalRadius} className="fill-ink" />,
        ])}
        {level.fans.map((f, i) => (
          <rect key={i} x={f.x - f.w / 2} y={f.y - f.h / 2} width={f.w} height={f.h} strokeDasharray="10 10" />
        ))}
        <path d={`M${cup.x - half - 3} ${top} L${cup.x + half + 3} ${top} L${cup.x + half - 1} ${bottom} L${cup.x - half + 1} ${bottom} Z`} />
      </g>
      {level.stars.map((s, i) => (
        <text key={i} x={s.x} y={s.y + 14} textAnchor="middle" fontSize="40" className="fill-coral">
          ★
        </text>
      ))}
      <circle cx={level.ball.x} cy={level.ball.y} r={PHYSICS.ballRadius + 6} className="fill-coral stroke-ink" strokeWidth="2" style={{ vectorEffect: 'non-scaling-stroke' }} />
    </svg>
  );
}
