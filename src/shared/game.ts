/** Points a player earns for calling the crowd. */
export const CALL_POINTS = {
  majority: 3,
  runnerUp: 1,
} as const;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Indexes of every option tied for the most votes; empty when nobody voted. */
export function majorityOf(tally: readonly number[]): number[] {
  const top = Math.max(0, ...tally);
  if (top === 0) return [];
  return tally.flatMap((count, index) => (count === top ? [index] : []));
}

/** Index of the clear second place, or undefined when there is none. */
function runnerUpOf(tally: readonly number[]): number | undefined {
  const leaders = majorityOf(tally);
  if (leaders.length !== 1) return undefined;
  const rest = tally.map((count, index) => (leaders.includes(index) ? 0 : count));
  const second = majorityOf(rest);
  return second.length === 1 ? second[0] : undefined;
}

/** Points for predicting `call` as the crowd's pick, given the final tally. */
export function scoreCall(call: number, tally: readonly number[]): number {
  if (majorityOf(tally).includes(call)) return CALL_POINTS.majority;
  if (runnerUpOf(tally) === call) return CALL_POINTS.runnerUp;
  return 0;
}

/** Whole-number shares that always add up to 100 (largest remainder). */
export function percentages(tally: readonly number[]): number[] {
  const total = tally.reduce((sum, count) => sum + count, 0);
  if (total === 0) return tally.map(() => 0);
  const exact = tally.map((count) => (count * 100) / total);
  const floors = exact.map(Math.floor);
  let missing = 100 - floors.reduce((sum, value) => sum + value, 0);
  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);
  const result = [...floors];
  for (const { index } of byRemainder) {
    if (missing === 0) break;
    result[index] = (result[index] ?? 0) + 1;
    missing -= 1;
  }
  return result;
}

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
