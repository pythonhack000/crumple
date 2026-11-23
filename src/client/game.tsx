import './index.css';

import { StrictMode, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type Phaser from 'phaser';
import { navigateToPost, showLoginPrompt, showToast } from '@devvit/web/client';
import type { InitResponse, LeaderRow, MyRound } from '../shared/api';
import type { Material } from '../shared/ball-art';
import type { Level } from '../shared/level';
import { shareText, TWIST_LABELS } from '../shared/share';
import { nameShot } from '../shared/shot-names';
import { PHYSICS } from '../shared/sim';
import { createGame } from './oneshot/scene';
import type { SceneData, ShotResult } from './oneshot/scene';
import { setMaterial } from './oneshot/audio';
import { Settings } from './oneshot/Settings';
import { BallEditor } from './oneshot/BallEditor';
import { Community } from './oneshot/Community';
import { LevelEditor } from './oneshot/LevelEditor';
import { SketchButton, SketchLink } from './oneshot/Sketchy';
import { useRound } from './oneshot/useRound';

const MISS_RESTART_MS = 450;
const SINK_RESTART_MS = 1100;

const STAR_PATH = 'M10 1.5 L12.4 7.2 L18.5 7.6 L13.8 11.6 L15.3 17.6 L10 14.3 L4.7 17.6 L6.2 11.6 L1.5 7.6 L7.6 7.2 Z';

/** The level's stars, drawn like the doodled stars on the page. */
function Stars({ got, of }: { got: number; of: number }) {
  return (
    <span aria-label={`${got} of ${of} stars`} className="inline-flex gap-1 self-center">
      {Array.from({ length: of }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className="h-5 w-5" aria-hidden="true">
          <path d={STAR_PATH} strokeWidth="1.8" strokeLinejoin="round" className={i < got ? 'fill-coral stroke-coral' : 'fill-none stroke-felt/40'} />
        </svg>
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
  names: string[];
  onPractice: () => void;
  onBuild: () => void;
};

async function copyResult(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copied. Paste it in the comments.');
  } catch (error) {
    console.error('Copying the result failed', error);
    showToast('Could not copy. Long-press the result to copy it.');
  }
}

function ResultCard({ data, sunk, names, onPractice, onBuild }: CardProps) {
  const headline = sunk.attempt === 1 ? 'Straight in' : `In on throw ${sunk.attempt}`;
  const result = shareText({
    dayNumber: data.round.dayNumber,
    levelName: data.round.level.name,
    twist: data.round.level.twist,
    attempt: sunk.attempt,
    stars: sunk.stars,
    starCount: data.round.level.stars.length,
    score: sunk.score,
    names,
  });
  const ghostLine =
    data.ghosts.length > 0 ? `The faint lines are ${data.ghosts.length} other ways in.` : 'You’re the first one in today.';
  return (
    <div className="absolute inset-x-3 bottom-3 rounded-2xl bg-ink p-5 text-felt">
      <p className="font-display text-4xl leading-tight">{headline}</p>
      {names.length > 0 && (
        <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {names.map((name) => (
            <span key={name} className="relative font-display text-xl text-coral">
              {name}
              <svg aria-hidden="true" viewBox="0 0 100 6" preserveAspectRatio="none" className="absolute -bottom-0.5 left-0 h-1.5 w-full">
                <path d="M1 4 C 25 1, 50 5, 75 2 S 95 3, 99 3" fill="none" strokeWidth="1.6" strokeLinecap="round" className="stroke-coral" vectorEffect="non-scaling-stroke" />
              </svg>
            </span>
          ))}
        </p>
      )}
      <p className="mt-1 flex items-baseline gap-3 text-lg">
        <Stars got={sunk.stars} of={data.round.level.stars.length} />
        <span className="font-display text-2xl font-bold tabular-nums">{sunk.score}</span>
        <span className="text-felt/70">points</span>
      </p>
      <p className="mt-1 text-sm text-felt/70">
        {sunk.bonus > 0 ? `Clean table bonus +${sunk.bonus}. ` : 'The table was a mess, no clean table bonus. '}
        {ghostLine}
      </p>
      <Board leaders={data.leaders} username={data.me?.username} />
      <pre className="mt-3 rounded-md bg-felt/10 px-3 py-2 font-sans text-sm whitespace-pre-wrap select-text">{result}</pre>
      <SketchButton tone="paper" onClick={() => void copyResult(result)} className="mt-3 w-full text-lg">
        Share result
      </SketchButton>
      <div className="mt-2 flex gap-2">
        <SketchButton onClick={onPractice} className="flex-1 px-2 text-base whitespace-nowrap">
          Go for stars
        </SketchButton>
        <SketchButton onClick={onBuild} className="flex-1 px-2 text-base whitespace-nowrap">
          Build a level
        </SketchButton>
        {data.todayPostId && (
          <SketchButton onClick={() => navigateToPost(data.todayPostId as `t3_${string}`)} className="flex-1">
            Today’s level
          </SketchButton>
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

const decoded = new Map<string, HTMLImageElement>();

/** Turns drawn-ball data URLs into images Phaser can use; cached by content. */
async function decodeArts(arts: Record<string, string>): Promise<Record<string, HTMLImageElement>> {
  const entries = await Promise.all(
    Object.entries(arts).map(async ([name, src]) => {
      const cached = decoded.get(src);
      if (cached) return [name, cached] as const;
      const image = new Image();
      image.src = src;
      try {
        await image.decode();
      } catch (error) {
        console.error(`Could not decode the ball drawn by ${name}`, error);
        return undefined;
      }
      decoded.set(src, image);
      return [name, image] as const;
    })
  );
  return Object.fromEntries(entries.filter((entry) => entry !== undefined));
}

function Play({ data, reportShot, shotError }: PlayProps) {
  const holder = useRef<HTMLDivElement>(null);
  const game = useRef<Phaser.Game | null>(null);
  const [hasLaunched, setHasLaunched] = useState((data.mine?.attempts ?? 0) > 0);
  const [isPractice, setIsPractice] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [shotNames, setShotNames] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [material, setMaterialState] = useState(data.material);
  const materialRef = useRef(material);
  useEffect(() => {
    setMaterial(material);
    materialRef.current = material;
  }, [material]);
  const level: Level = data.round.level;
  const sunk = data.mine?.sunk ?? null;
  const isLoggedIn = data.me !== null;
  const isClosed = data.round.status === 'closed';
  const username = data.me?.username;
  const [isDrawing, setIsDrawing] = useState(false);
  const [panel, setPanel] = useState<'community' | 'editor' | null>(null);
  const [remixFrom, setRemixFrom] = useState<Level | undefined>(undefined);
  const [artImages, setArtImages] = useState<Record<string, HTMLImageElement>>({});
  const [myArt, setMyArt] = useState<string | null>(username ? (data.arts[username] ?? null) : null);

  // Scene callbacks outlive renders, so they read the latest values from refs.
  const latest = useRef({ reportShot, isPractice: false });
  useEffect(() => {
    latest.current = { reportShot, isPractice };
  }, [reportShot, isPractice]);
  // What is on the table: other players' paths and this player's missed balls.
  const table = useRef({ ghosts: data.ghosts, pile: data.pile, arts: {} as Record<string, HTMLImageElement> });

  const restart = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (!holder.current) return;
    const makeData = (): SceneData => ({
      level,
      ghosts: table.current.ghosts,
      pile: table.current.pile,
      arts: table.current.arts,
      username,
      material: materialRef.current,
      onLaunch: () => setHasLaunched(true),
      onResult: (result: ShotResult) => {
        const counts = !latest.current.isPractice && isLoggedIn && !isClosed;
        const report = counts
          ? latest.current.reportShot({ sunk: result.sunk, stars: result.stars, path: result.path, rest: result.rest, owners: result.stats.owners })
          : Promise.resolve(undefined);
        if (!result.sunk && result.rest) {
          // Show the miss at once; the server's shared pile replaces it when it answers.
          const mineNow = { ...result.rest, mine: true, owner: username ?? '' };
          table.current = { ...table.current, pile: [...table.current.pile, mineNow].slice(-PHYSICS.maxLeftovers) };
        }
        void report.then(async (response) => {
          if (!response) return;
          const arts = await decodeArts(response.arts);
          table.current = { ...table.current, pile: response.pile, arts: { ...table.current.arts, ...arts } };
          setArtImages(table.current.arts);
        });
        if (result.sunk && counts) {
          void report.then((response) => {
            if (response?.mine.sunk) {
              setShotNames(nameShot(result.stats, response.mine.sunk.attempt));
              // Confirmed: the result card shows; redraw with everyone's paths.
              if (!response.ghosts.length) return;
              table.current = { ...table.current, ghosts: response.ghosts };
              restart.current();
              return;
            }
            // Not confirmed (network trouble or already scored): never leave the player stuck.
            setFlash('In the bin');
            window.setTimeout(() => {
              setFlash(null);
              restart.current();
            }, SINK_RESTART_MS);
          });
          return;
        }
        const shotName = result.sunk ? nameShot(result.stats, 0)[0] : undefined;
        setFlash(result.sunk ? (shotName ? `In, ${shotName.toLowerCase()}` : 'In the bin') : 'Missed');
        window.setTimeout(
          () => {
            setFlash(null);
            restart.current();
          },
          result.sunk ? SINK_RESTART_MS : MISS_RESTART_MS
        );
      },
    });
    restart.current = () => game.current?.scene.getScene('play')?.scene.restart(makeData());
    let isCancelled = false;
    const parent = holder.current;
    // Drawn balls must be decoded before the scene can use them as textures.
    void decodeArts(data.arts).then((arts) => {
      if (isCancelled) return;
      table.current = { ...table.current, arts };
      setArtImages(arts);
      game.current = createGame(parent, makeData());
    });
    return () => {
      isCancelled = true;
      game.current?.destroy(true);
      game.current = null;
    };
    // The scene is built once per level; later data flows through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, isLoggedIn, isClosed]);

  const handleArtSaved = async (art: string | null, chosen: Material) => {
    setIsDrawing(false);
    setMyArt(art);
    setMaterialState(chosen);
    if (!username) return;
    const rest = Object.fromEntries(Object.entries(table.current.arts).filter(([name]) => name !== username));
    const mine = art ? await decodeArts({ [username]: art }) : {};
    table.current = { ...table.current, arts: { ...rest, ...mine } };
    setArtImages(table.current.arts);
    materialRef.current = chosen;
    restart.current();
  };

  const handlePractice = () => {
    latest.current = { ...latest.current, isPractice: true };
    setIsPractice(true);
    restart.current();
  };

  const attempts = data.mine?.attempts ?? 0;
  let status = `Shot ${attempts + 1}`;
  if (sunk) status = isPractice ? 'Practice' : `In on shot ${sunk.attempt}`;
  if (flash) status = flash;

  return (
    <main className="relative mx-auto flex h-screen max-w-[480px] flex-col bg-felt text-ink select-none">
      <header className="px-4 pt-3 pb-1">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="truncate font-display text-2xl">
            #{data.round.dayNumber} <span className="text-ink-soft">{level.name}</span>
          </h1>
          <p className={`shrink-0 font-semibold tabular-nums ${flash ? 'text-coral' : ''}`}>{status}</p>
        </div>
        <div className="mt-1 flex gap-5">
          <SketchLink onClick={() => setPanel('community')}>Levels</SketchLink>
          {isLoggedIn && <SketchLink onClick={() => setIsDrawing(true)}>{myArt ? 'Your ball' : 'Draw your ball'}</SketchLink>}
          <SketchLink onClick={() => setIsSettingsOpen(true)}>Settings</SketchLink>
        </div>
        {level.twist && (
          <p className="mt-1 font-display text-base text-coral">
            {TWIST_LABELS[level.twist].name}: {TWIST_LABELS[level.twist].rule}
          </p>
        )}
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
      {isDrawing && (
        <BallEditor
          current={myArt}
          material={material}
          onClose={() => setIsDrawing(false)}
          onSaved={(art, chosen) => void handleArtSaved(art, chosen)}
        />
      )}
      {sunk && !isPractice && !isDrawing && !panel && (
        <ResultCard data={data} sunk={sunk} names={shotNames} onPractice={handlePractice} onBuild={() => {
            setRemixFrom(undefined);
            setPanel('editor');
          }} />
      )}
      {isSettingsOpen && <Settings onClose={() => setIsSettingsOpen(false)} />}
      {panel === 'community' && (
        <Community
          arts={artImages}
          username={username}
          onBuild={() => {
            setRemixFrom(undefined);
            setPanel(isLoggedIn ? 'editor' : null);
          }}
          onRemix={(item) => {
            setRemixFrom({
              ...item.level,
              name: `${item.level.name} remix`.slice(0, 32),
              author: null,
              basedOn: item.level.basedOn ?? item.author,
            });
            setPanel('editor');
          }}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'editor' && (
        <LevelEditor
          {...(remixFrom ? { initial: remixFrom } : {})}
          arts={artImages}
          username={username}
          onClose={() => setPanel(null)}
          onShared={() => setPanel('community')}
        />
      )}
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
