import type { ShotStats } from './sim';

/** Names a sinking shot, Peggle style. At most three, the most special first. */
export function nameShot(stats: ShotStats, attempt: number): string[] {
  const names: string[] = [];
  const contacts = stats.walls + stats.bumpers + stats.pileBalls;
  if (attempt === 1) names.push('Hole in one');
  const [helper, ...others] = stats.owners;
  if (helper) names.push(others.length > 0 ? `Assist from u/${helper} +${others.length}` : `Assist from u/${helper}`);
  if (contacts === 0 && stats.portals === 0) names.push('Swish');
  if (stats.portals > 0) names.push('Through the vent');
  if (stats.bumpers >= 2) names.push('Pinball');
  else if (contacts >= 3) names.push(`Ricochet ×${contacts}`);
  else if (stats.walls === 1 && contacts === 1) names.push('Bank shot');
  return names.slice(0, 3);
}
