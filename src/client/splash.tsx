import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';
import { useRound } from './oneshot/useRound';

function statusLine(data: InitResponse): string {
  const { players, holesInOne, status } = data.round;
  if (status === 'closed') return `${players.toLocaleString('en-US')} played. This one is closed.`;
  if (players === 0) return 'Nobody has taken a shot yet. Be first.';
  const hio = holesInOne === 1 ? '1 hole in one' : `${holesInOne} holes in one`;
  return `${players.toLocaleString('en-US')} ${players === 1 ? 'player' : 'players'} so far, ${hio}.`;
}

function buttonLabel(data: InitResponse): string {
  const attempts = data.mine?.attempts ?? 0;
  if (data.round.status === 'closed') return 'See the level';
  if (data.mine?.sunk) return `You’re in with ${data.mine.sunk.score}. Practice`;
  if (attempts > 0) return `Keep going, shot ${attempts + 1}`;
  return 'Take your shot';
}

export function Splash() {
  const { state, reload } = useRound();
  if (state.status === 'loading') return <div className="min-h-screen bg-felt" />;
  if (state.status === 'error') {
    return (
      <main className="flex min-h-screen flex-col justify-center gap-3 bg-felt p-5 text-ink">
        <p>{state.message}</p>
        <button
          type="button"
          className="h-11 self-start rounded-full bg-ink px-5 font-semibold text-felt"
          onClick={() => void reload()}
        >
          Try again
        </button>
      </main>
    );
  }
  const { data } = state;
  const streak = data.me && data.me.streak > 1 ? ` You’re on a ${data.me.streak}-day run.` : '';
  return (
    <main className="flex min-h-screen flex-col justify-between gap-4 bg-felt p-5 text-ink">
      <p className="text-ink-soft">
        One Shot #{data.round.dayNumber}. Same level for everyone. Every miss stays on the table.{streak}
      </p>
      <h1 className="font-display text-[2.4rem] font-bold leading-[1.02]">{data.round.level.name}</h1>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-ink-soft">{statusLine(data)}</p>
        <button
          type="button"
          className="h-12 rounded-full bg-coral font-semibold text-ink"
          onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
        >
          {buttonLabel(data)}
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
