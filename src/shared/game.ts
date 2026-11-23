const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The UTC calendar day, as YYYY-MM-DD. */
export function dayKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Whole UTC days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / MS_PER_DAY);
}

/** The play streak after playing on `today`. */
export function nextStreak(lastDay: string | undefined, streak: number, today: string): number {
  if (!lastDay) return 1;
  const gap = daysBetween(lastDay, today);
  if (gap === 0) return Math.max(streak, 1);
  if (gap === 1) return streak + 1;
  return 1;
}
