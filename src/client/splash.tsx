import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { DayView } from '../shared/api';
import { people, timeLeft, useNow } from './time';
import { useHunch } from './useHunch';

function buttonLabel(day: DayView): string {
  if (day.status === 'closed') return 'See how the crowd went';
  if (day.myPick !== null) return 'See your hunch';
  return 'Play';
}

function statusLine(day: DayView, now: number): string {
  if (day.status === 'closed') return `${people(day.players)} played. Results are in.`;
  return `${people(day.players)} played so far. Answer revealed in ${timeLeft(day.closesAt, now)}.`;
}

export function Splash() {
  const { state, reload } = useHunch();
  const now = useNow();

  if (state.status === 'loading') return <div className="min-h-screen bg-paper" />;
  if (state.status === 'error') {
    return (
      <main className="flex min-h-screen flex-col justify-center gap-3 p-5">
        <p>{state.message}</p>
        <button type="button" className="h-11 self-start rounded-full bg-ink px-5 font-semibold text-paper" onClick={() => void reload()}>
          Try again
        </button>
      </main>
    );
  }

  const { day } = state.data;
  return (
    <main className="flex min-h-screen flex-col justify-between gap-5 p-5">
      <p className="text-sm text-muted">Hunch #{day.dayNumber}: answer, then guess what most people said</p>
      <h1 className="font-display text-[2rem] font-bold leading-[1.08] tracking-[-0.01em] text-balance">
        {day.question.prompt}
      </h1>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">{statusLine(day, now)}</p>
        <button
          type="button"
          className="h-12 rounded-full bg-marker font-semibold text-on-marker"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          {buttonLabel(day)}
        </button>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
