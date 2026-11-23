import type { Twist } from './level';

export const TWIST_LABELS: Record<Twist, { name: string; rule: string }> = {
  moon: { name: 'Moon day', rule: 'Gravity is low today.' },
  bouncy: { name: 'Bouncy day', rule: 'The ball bounces like rubber today.' },
  glass: { name: 'Glass day', rule: 'The ball is glass today. Hit anything too hard and it shatters.' },
  'moving-bin': { name: 'Moving bin day', rule: 'The bin dodges once you throw.' },
};

const MAX_SQUARES = 10;

export type ShareInput = {
  dayNumber: number;
  levelName: string;
  twist: Twist | undefined;
  attempt: number;
  stars: number;
  starCount: number;
  score: number;
  names: string[];
};

/** A spoiler-free result to paste in the comments: no path, no aim, just how it went. */
export function shareText(input: ShareInput): string {
  const misses = input.attempt - 1;
  // A crumpled sheet for each miss, the bin for the throw that went in.
  const throws = input.attempt <= MAX_SQUARES ? `${'📄'.repeat(misses)}🗑️` : `📄×${misses} 🗑️`;
  const stars = '★'.repeat(input.stars) + '☆'.repeat(Math.max(0, input.starCount - input.stars));
  const twist = input.twist ? ` · ${TWIST_LABELS[input.twist].name}` : '';
  const story =
    misses === 0
      ? 'in on the first throw'
      : `${misses} ${misses === 1 ? 'miss' : 'misses'}, then in on throw ${input.attempt}`;
  const details = [stars, `${input.score} points`, ...input.names.slice(0, 2)].filter(Boolean).join(' · ');
  return [`Crumple #${input.dayNumber} · ${input.levelName}${twist}`, `${throws} ${story}`, details].join('\n');
}
