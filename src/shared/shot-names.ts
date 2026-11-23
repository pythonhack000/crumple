import type { ShotStats } from './sim';

/** Names a sinking shot, Peggle style. At most three, the most special first. */
export function nameShot(stats: ShotStats, attempt: number): string[] {
  const names: string[] = [];
  const contacts = stats.walls + stats.bumpers + stats.pileBalls;
  if (attempt === 1) names.push('Hole in one');
  const [helper, ...others] = stats.owners;
  if (helper) {
    const more = others.length === 1 ? ' and 1 more' : others.length > 1 ? ` and ${others.length} more` : '';
    names.push(`Assist from u/${helper}${more}`);
  }
  if (contacts === 0 && stats.portals === 0) names.push('Swish');
  if (stats.portals > 0) names.push('Through the vent');
  if (stats.bumpers >= 2) names.push('Pinball');
  else if (contacts >= 3) names.push(`${contacts}-bounce ricochet`);
  else if (stats.walls === 1 && contacts === 1) names.push('Bank shot');
  return names.slice(0, 3);
}
