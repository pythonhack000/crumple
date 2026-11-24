import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api';
import { TWIST_LABELS } from '../shared/share';
import { LevelSketch, Scribble, SketchButton } from './oneshot/Sketchy';
import { useRound } from './oneshot/useRound';

function statusLine(data: InitResponse): string {
  const { players, holesInOne, status } = data.round;
  if (status === 'closed') return `${players.toLocaleString('en-US')} played. This one is closed.`;
  if (players === 0) return 'Nobody has thrown yet. Be first.';
  const hio = holesInOne === 1 ? '1 got it first try' : `${holesInOne} got it first try`;
  return `${players.toLocaleString('en-US')} ${players === 1 ? 'player' : 'players'} so far, ${hio}.`;
}

function buttonLabel(data: InitResponse): string {
  const attempts = data.mine?.attempts ?? 0;
  if (data.round.status === 'closed') return 'See the level';
  if (data.mine?.sunk) return `In with ${data.mine.sunk.score}. Practice`;
  if (attempts > 0) return `Keep going, throw ${attempts + 1}`;
  return 'Take your shot';
}

export function Splash() {
  const { state, reload } = useRound();
  if (state.status === 'loading') return <div className="min-h-screen bg-felt" />;
  if (state.status === 'error') {
    return (
      <main className="flex min-h-screen flex-col justify-center gap-3 bg-felt p-5 text-ink">
        <p>{state.message}</p>
        <SketchButton className="self-start" onClick={() => void reload()}>
          Try again
        </SketchButton>
      </main>
    );
  }
  const { data } = state;
  const streak = data.me && data.me.streak > 1 ? ` You’re on a ${data.me.streak}-day run.` : '';
  return (
    <main className="flex min-h-screen gap-4 bg-felt p-4 text-ink sm:p-5">
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
        <p className="text-sm text-ink-soft">
          Crumple #{data.round.dayNumber}. Every miss stays on the table.{streak}
        </p>
        {data.round.level.twist && (
          <p className="-rotate-2 self-start rounded-sm bg-coral px-2 font-display text-lg text-ink">
            {TWIST_LABELS[data.round.level.twist].name}: {TWIST_LABELS[data.round.level.twist].rule}
          </p>
        )}
        <div className="-rotate-1">
          <h1 className="font-display text-[2rem] leading-[1.05] font-normal sm:text-[2.5rem]">{data.round.level.name}</h1>
          <Scribble className="mt-1 max-w-[16rem]" />
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">{statusLine(data)}</p>
          <SketchButton className="self-start" onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}>
            {buttonLabel(data)}
          </SketchButton>
        </div>
      </div>
      <LevelSketch
        level={data.round.level}
        withPaper
        className="h-auto max-h-[calc(100vh-2.5rem)] w-[42%] max-w-[15rem] shrink-0 rotate-1 self-center rounded-sm bg-felt shadow-[0_0_0_1px_rgba(34,64,143,0.18),0_6px_14px_-8px_rgba(34,64,143,0.35)]"
      />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
