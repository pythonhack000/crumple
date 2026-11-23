import { useEffect, useState } from 'react';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

/** "5h 12m" or "12m" until the given time; "any second" once it has passed. */
export function timeLeft(untilIso: string, now: number): string {
  const ms = Date.parse(untilIso) - now;
  if (ms <= 0) return 'any second';
  const hours = Math.floor(ms / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  return hours > 0 ? `${hours}h ${minutes}m` : `${Math.max(minutes, 1)}m`;
}

export function useNow(intervalMs = 30 * SECOND): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

export const people = (count: number) => `${count.toLocaleString('en-US')} ${count === 1 ? 'person' : 'people'}`;
