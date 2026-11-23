import './index.css';

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type Phaser from 'phaser';
import { navigateToPost, showLoginPrompt } from '@devvit/web/client';
import type { InitResponse, LeaderRow, MyRound } from '../shared/api';
import type { Level, Point } from '../shared/level';
import { createGame } from './oneshot/scene';
import type { SceneData, ShotResult } from './oneshot/scene';
import { useRound } from './oneshot/useRound';

const MISS_RESTART_MS = 450;

function Stars({ got, of }: { got: number; of: number }) {
  return (
    <span aria-label={`${got} of ${of} stars`} className="tracking-[0.15em]">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < got ? 'text-coral' : 'text-felt/30'}>
          ★
        </span>
      ))}
    </span>
  );
}

function Board({ leaders, username }: { leaders: LeaderRow[]; username: string | undefined }) {
  if (leaders.length === 0) return null;
  return (
    <ol className="mt-3 flex flex-col text-sm">
      {leaders.map((row, index) => (
        <li
          key={row.username}
          className={`flex gap-3 border-t border-felt/15 py-1.5 ${row.username === username ? 'font-semibold text-coral' : ''}`}
        >
          <span className="w-4 tabular-nums text-felt/60">{index + 1}</span>
          <span className="flex-1 truncate">u/{row.username}</span>
          <span className="tabular-nums">{row.score}</span>
        </li>
      ))}
    </ol>
  );
}

type CardProps = {
  data: InitResponse;
  sunk: NonNullable<MyRound['sunk']>;
  onPractice: () => void;
};

function ResultCard({ data, sunk, onPractice }: CardProps) {
  const headline = sunk.attempt === 1 ? 'One shot. In.' : `In on shot ${sunk.attempt}.`;
  const ghostLine =
    data.ghosts.length > 0 ? `The faint lines are ${data.ghosts.length} other ways in.` : 'You’re the first one in today.';
  return (
    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-ink p-5 text-felt">
      <p className="font-display text-3xl font-bold leading-tight">{headline}</p>
      <p className="mt-1 flex items-baseline gap-3 text-lg">
        <Stars got={sunk.stars} of={data.round.level.stars.length} />
        <span className="font-display text-2xl font-bold tabular-nums">{sunk.score}</span>
        <span className="text-felt/70">points</span>
      </p>
      <p className="mt-1 text-sm text-felt/70">{ghostLine}</p>
      <Board leaders={data.leaders} username={data.me?.username} />
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onPractice} className="h-12 flex-1 rounded-full bg-coral font-semibold text-ink">
          Practice for stars
        </button>
        {data.todayPostId && (
          <button
            type="button"
            onClick={() => navigateToPost(data.todayPostId as `t3_${string}`)}
            className="h-12 flex-1 rounded-full border-2 border-felt/40 font-semibold"
          >
            Today’s level
          </button>
        )}
      </div>
    </div>
  );
}

type PlayProps = {
  data: InitResponse;
  reportShot: ReturnType<typeof useRound>['reportShot'];
  shotError: string | null;
};

function Play({ data, reportShot, shotError }: PlayProps) {
  const holder = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [hasLaunched, setHasLaunched] = useState((data.mine?.attempts ?? 0) > 0);
  const [isPractice, setIsPractice] = useState(false);
  const [missFlash, setMissFlash] = useState(false);
  const level: Level = data.round.level;
  const sunk = data.mine?.sunk ?? null;
  const isLoggedIn = data.me !== null;
  const isClosed = data.round.status === 'closed';

  // Latest values for scene callbacks, which outlive renders.
  const latest = useRef({ reportShot, ghosts: data.ghosts });
  useEffect(() => {
    latest.current = { reportShot, ghosts: data.ghosts };
  }, [reportShot, data.ghosts]);

  useEffect(() => {
    if (!holder.current) return;
    const restart = (ghosts: Point[][]) => game.current?.scene.getScene('play')?.scene.restart(makeData(ghosts));
    const makeData = (ghosts: Point[][]): SceneData => ({
      level,
      ghosts,
      onLaunch: () => setHasLaunched(true),
      onResult: (result: ShotResult) => {
        const report = isLoggedIn && !isClosed ? latest.current.reportShot(result) : Promise.resolve(undefined);
        if (result.sunk) {
          // Redraw with everyone's paths once the server confirms the sink.
          void report.then((response) => {
            if (response?.ghosts.length) restart(response.ghosts);
          });
          return;
        }
        setMissFlash(true);
        window.setTimeout(() => {
          setMissFlash(false);
          restart(latest.current.ghosts);
        }, MISS_RESTART_MS);
      },
    });
    game.current = createGame(holder.current, makeData(latest.current.ghosts));
    return () => {
      game.current?.destroy(true);
      game.current = null;
    };
  }, [level, isLoggedIn, isClosed]);

  const handlePractice = () => {
    setIsPractice(true);
    game.current?.scene.getScene('play')?.scene.restart({ ...game.current.scene.getScene('play')?.sys.settings.data });
  };

  const attempts = data.mine?.attempts ?? 0;
  let status = `Shot ${attempts + 1}`;
  if (sunk) status = isPractice ? 'Practice' : `In on shot ${sunk.attempt}`;
  if (missFlash) status = 'Missed';

  return (
    <main className="relative mx-auto flex h-screen max-w-[480px] flex-col bg-felt text-ink select-none">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1">
        <h1 className="truncate font-display text-xl font-bold">
          #{data.round.dayNumber} <span className="font-normal text-ink-soft">{level.name}</span>
        </h1>
        <p className={`shrink-0 font-semibold tabular-nums ${missFlash ? 'text-coral' : ''}`}>{status}</p>
      </header>
      {!isLoggedIn && (
        <button
          type="button"
          onClick={showLoginPrompt}
          className="mx-3 mb-1 h-10 rounded-full bg-ink text-sm font-semibold text-felt"
        >
          Log in to get on the board
        </button>
      )}
      <div ref={holder} className="relative min-h-0 flex-1 touch-none" />
      {!hasLaunched && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-ink-soft">
          Drag anywhere, pull back, let go
        </p>
      )}
      {shotError && (
        <p role="alert" className="absolute inset-x-3 top-12 rounded-lg bg-ink px-3 py-2 text-sm text-felt">
          {shotError}
        </p>
      )}
      {sunk && !isPractice && <ResultCard data={data} sunk={sunk} onPractice={handlePractice} />}
    </main>
  );
}

export function App() {
  const { state, reload, reportShot, shotError } = useRound();
  if (state.status === 'loading') return <p className="p-6 text-ink-soft">Setting up today’s level…</p>;
  if (state.status === 'error') {
    return (
      <main className="flex flex-col gap-3 p-6">
        <p>{state.message}</p>
        <button type="button" className="h-11 self-start rounded-full bg-ink px-5 font-semibold text-felt" onClick={() => void reload()}>
          Try again
        </button>
      </main>
    );
  }
  return <Play data={state.data} reportShot={reportShot} shotError={shotError} />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
