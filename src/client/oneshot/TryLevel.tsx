import { useEffect, useRef, useState } from 'react';
import type Phaser from 'phaser';
import type { Level } from '../../shared/level';
import { createGame } from './scene';
import type { SceneData } from './scene';
import { SketchButton } from './Sketchy';

const RESTART_MS = 450;

type TryLevelProps = {
  level: Level;
  title: string;
  arts: Record<string, HTMLImageElement>;
  username: string | undefined;
  onSunk?: () => void;
  onClose: () => void;
};

/** Plays a level for fun or to prove it can be beaten. Nothing is scored. */
export function TryLevel({ level, title, arts, username, onSunk, onClose }: TryLevelProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('Drag anywhere, pull back, let go');
  const [throws, setThrows] = useState(1);
  const latest = useRef({ onSunk });
  useEffect(() => {
    latest.current = { onSunk };
  }, [onSunk]);

  useEffect(() => {
    if (!holder.current) return;
    let game: Phaser.Game | null = null;
    const makeData = (): SceneData => ({
      level,
      ghosts: [],
      pile: [],
      arts,
      username,
      material: 'paper',
      onLaunch: () => setMessage(''),
      onResult: (result) => {
        if (result.sunk) {
          setMessage(`In! ${'★'.repeat(result.stars)}`);
          latest.current.onSunk?.();
        } else {
          setMessage('Missed');
          setThrows((value) => value + 1);
        }
        window.setTimeout(() => game?.scene.getScene('play')?.scene.restart(makeData()), RESTART_MS * (result.sunk ? 2 : 1));
      },
    });
    game = createGame(holder.current, makeData());
    return () => game?.destroy(true);
  }, [level, arts, username]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-felt text-ink">
      <header className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-1">
        <h2 className="truncate font-display text-2xl">{title}</h2>
        <p className="shrink-0 font-semibold tabular-nums">{message || `Throw ${throws}`}</p>
      </header>
      <div ref={holder} className="relative min-h-0 flex-1 touch-none" />
      <div className="flex justify-center p-3">
        <SketchButton onClick={onClose}>Done</SketchButton>
      </div>
    </div>
  );
}
