import type { Twist } from './level';

export const TWIST_LABELS: Record<Twist, { name: string; rule: string }> = {
  moon: { name: 'Moon day', rule: 'Gravity is low today.' },
  bouncy: { name: 'Bouncy day', rule: 'The ball bounces like rubber today.' },
  glass: { name: 'Glass day', rule: 'The ball is glass today. Hit anything too hard and it shatters.' },
  'moving-bin': { name: 'Moving bin day', rule: 'The bin dodges once you throw.' },
};

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

const NUMBER_WORDS = ['', 'once', 'twice'];

/**
 * A spoiler-free result to paste in the comments, written the way a person
 * would type it: no path, no aim, no emoji.
 */
export function shareText(input: ShareInput): string {
  const misses = input.attempt - 1;
  const twist = input.twist ? ` (${TWIST_LABELS[input.twist].name.toLowerCase()})` : '';
  const story =
    misses === 0
      ? 'Sank it on the first throw'
      : `Missed ${NUMBER_WORDS[misses] ?? `${misses} times`}, sank it on throw ${input.attempt}`;
  const stars = input.starCount > 0 ? `${input.stars} of ${input.starCount} stars` : '';
  const details = [stars, `${input.score} points`, ...input.names.slice(0, 2).map((name) => name.toLowerCase())]
    .filter(Boolean)
    .join(', ');
  return [`Crumple #${input.dayNumber}, ${input.levelName}${twist}`, story, details].join('\n');
}
