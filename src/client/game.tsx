import './index.css';

import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type Phaser from 'phaser';
import type { Level, Point } from '../shared/level';
import { shotScore } from '../shared/level';
import { builtInLevelFor } from '../shared/levels';
import { createGame } from './oneshot/scene';
import type { SceneData, ShotResult } from './oneshot/scene';

const MISS_RESTART_MS = 450;
const LAUNCH_DAY = Date.UTC(2026, 10, 23);

function todayNumber(): number {
  return Math.floor((Date.now() - LAUNCH_DAY) / 86_400_000) + 1;
}

type Sunk = { attempt: number; stars: number; score: number; path: Point[] };

function Stars({ got, of }: { got: number; of: number }) {
  return (
    <span aria-label={`${got} of ${of} stars`} className="tracking-[0.15em]">
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={i < got ? 'text-coral' : 'text-ink/25'}>
          ★
        </span>
      ))}
    </span>
  );
}

type ResultCardProps = {
  sunk: Sunk;
  level: Level;
  onPractice: () => void;
};

function ResultCard({ sunk, level, onPractice }: ResultCardProps) {
  const headline = sunk.attempt === 1 ? 'One shot. In.' : `In on shot ${sunk.attempt}.`;
  return (
    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-ink p-5 text-felt shadow-[0_12px_0_-4px_rgba(18,48,42,0.25)]">
      <p className="font-display text-3xl font-bold leading-tight">{headline}</p>
      <p className="mt-1 flex items-baseline gap-3 text-lg">
        <Stars got={sunk.stars} of={level.stars.length} />
        <span className="font-display text-2xl font-bold tabular-nums">{sunk.score}</span>
        <span className="text-felt/70">points locked in</span>
      </p>
      <button
        type="button"
        onClick={onPractice}
        className="mt-4 h-12 w-full rounded-full bg-coral font-semibold text-ink"
      >
        Practice for more stars
      </button>
    </div>
  );
}

export function App() {
  const day = todayNumber();
  const level = builtInLevelFor(day);
  const holder = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [hasLaunched, setHasLaunched] = useState(false);
  const [sunk, setSunk] = useState<Sunk | null>(null);
  const [isPractice, setIsPractice] = useState(false);
  const [missFlash, setMissFlash] = useState(false);

  // The scene reads these through refs so callbacks never go stale.
  const attemptRef = useRef(attempt);
  const lockedRef = useRef(false);
  useEffect(() => {
    attemptRef.current = attempt;
    lockedRef.current = sunk !== null;
  }, [attempt, sunk]);

  const restartScene = useCallback((data: SceneData) => {
    game.current?.scene.getScene('play')?.scene.restart(data);
  }, []);

  const sceneData = useCallback((): SceneData => {
    const data: SceneData = {
      level,
      ghosts: [],
      onLaunch: () => setHasLaunched(true),
      onResult: (result: ShotResult) => {
        if (result.sunk) {
          if (!lockedRef.current) {
            setSunk({
              attempt: attemptRef.current,
              stars: result.stars,
              score: shotScore(attemptRef.current, result.stars),
              path: result.path,
            });
          }
          return;
        }
        setMissFlash(true);
        window.setTimeout(() => {
          setMissFlash(false);
          if (!lockedRef.current) setAttempt((value) => value + 1);
          restartScene(data);
        }, MISS_RESTART_MS);
      },
    };
    return data;
  }, [level, restartScene]);

  useEffect(() => {
    if (!holder.current) return;
    game.current = createGame(holder.current, sceneData());
    return () => {
      game.current?.destroy(true);
      game.current = null;
    };
  }, [sceneData]);

  const handlePractice = () => {
    setIsPractice(true);
    restartScene(sceneData());
  };

  const showCard = sunk !== null && !isPractice;
  const shotLabel = sunk ? (isPractice ? 'Practice' : `In on shot ${sunk.attempt}`) : `Shot ${attempt}`;

  return (
    <main className="relative mx-auto flex h-screen max-w-[480px] flex-col bg-felt text-ink select-none">
      <header className="flex items-baseline justify-between px-4 pt-3 pb-1">
        <h1 className="font-display text-xl font-bold">
          One Shot #{day} <span className="font-normal text-ink-soft">{level.name}</span>
        </h1>
        <p className={`tabular-nums font-semibold transition-colors ${missFlash ? 'text-coral' : ''}`}>
          {missFlash ? 'Missed' : shotLabel}
        </p>
      </header>
      <div ref={holder} className="relative min-h-0 flex-1 touch-none" />
      {!hasLaunched && (
        <p className="pointer-events-none absolute inset-x-0 bottom-6 text-center text-ink-soft">
          Drag anywhere, pull back, let go
        </p>
      )}
      {showCard && <ResultCard sunk={sunk} level={level} onPractice={handlePractice} />}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
