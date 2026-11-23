import { useMemo, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { ErrorResponse, SubmitLevelResponse } from '../../shared/api';
import { movePiece, pickPiece, wallEnds } from '../../shared/editing';
import type { Pick } from '../../shared/editing';
import type { Level, Point } from '../../shared/level';
import { LIMITS, TWISTS, WORLD } from '../../shared/level';
import type { Twist } from '../../shared/level';
import { TWIST_LABELS } from '../../shared/share';
import { PHYSICS } from '../../shared/sim';
import { LevelSketch, SketchButton, SketchChip, SketchLink, ToolIcon } from './Sketchy';
import { TryLevel } from './TryLevel';

type Tool = 'move' | 'shelf' | 'bumper' | 'star' | 'fan' | 'vent' | 'ball' | 'bin' | 'erase';

const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'move', label: 'Move', hint: 'Drag anything to move it. Drag a shelf by its end to turn and stretch it.' },
  { id: 'shelf', label: 'Shelf', hint: 'Drag a line to draw a shelf. It follows your angle.' },
  { id: 'bumper', label: 'Bouncy', hint: 'Tap to drop a stress ball. The ball bounces off it hard.' },
  { id: 'star', label: 'Star', hint: 'Tap to place a star, up to three.' },
  { id: 'fan', label: 'Fan', hint: 'Drag the way the air should blow.' },
  { id: 'vent', label: 'Vents', hint: 'Tap two spots. A ball entering one pops out of the other.' },
  { id: 'ball', label: 'Ball', hint: 'Tap where the ball starts.' },
  { id: 'bin', label: 'Bin', hint: 'Tap where the bin goes.' },
  { id: 'erase', label: 'Erase', hint: 'Tap a piece to remove it.' },
];

const SHELF_THICKNESS = 12;
const MIN_SHELF = 30;
const BUMPER_RADIUS = 18;
const FAN_SIZE = { w: 70, h: 180 };
const ERASE_REACH = 26;

const START_LEVEL: Level = {
  name: '',
  author: null,
  ball: { x: 60, y: 540 },
  cup: { x: 290, y: 300 },
  walls: [
    { x: 60, y: 560, w: 80, h: SHELF_THICKNESS, angle: 0 },
    { x: 290, y: 340, w: 90, h: SHELF_THICKNESS, angle: 0 },
  ],
  bumpers: [],
  portals: [],
  fans: [],
  stars: [],
};

const clamp = (value: number, max: number) => Math.min(max, Math.max(0, Math.round(value)));
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** Removes the piece closest to `at`, if any is within reach. */
function erase(level: Level, at: Point): Level {
  const near = (p: Point) => dist(p, at) < ERASE_REACH;
  const wallIndex = level.walls.findIndex((w) => {
    const r = (-w.angle * Math.PI) / 180;
    const dx = at.x - w.x;
    const dy = at.y - w.y;
    const lx = dx * Math.cos(r) - dy * Math.sin(r);
    const ly = dx * Math.sin(r) + dy * Math.cos(r);
    return Math.abs(lx) <= w.w / 2 + 6 && Math.abs(ly) <= w.h / 2 + 10;
  });
  if (level.stars.some(near)) return { ...level, stars: level.stars.filter((s) => !near(s)) };
  if (level.bumpers.some(near)) return { ...level, bumpers: level.bumpers.filter((b) => !near(b)) };
  if (level.portals.some((p) => near(p.a) || near(p.b))) {
    return { ...level, portals: level.portals.filter((p) => !near(p.a) && !near(p.b)) };
  }
  if (level.fans.some((f) => Math.abs(f.x - at.x) < f.w / 2 && Math.abs(f.y - at.y) < f.h / 2)) {
    return { ...level, fans: level.fans.filter((f) => !(Math.abs(f.x - at.x) < f.w / 2 && Math.abs(f.y - at.y) < f.h / 2)) };
  }
  if (wallIndex >= 0) return { ...level, walls: level.walls.filter((_, i) => i !== wallIndex) };
  return level;
}

type LevelEditorProps = {
  /** A level to start from, e.g. when remixing someone else's. */
  initial?: Level;
  arts: Record<string, HTMLImageElement>;
  username: string | undefined;
  onClose: () => void;
  onShared: () => void;
};

export function LevelEditor({ initial, arts, username, onClose, onShared }: LevelEditorProps) {
  const [history, setHistory] = useState<Level[]>([initial ?? START_LEVEL]);
  const level = history[history.length - 1] ?? START_LEVEL;
  const [name, setName] = useState(initial?.name ?? '');
  const [tool, setTool] = useState<Tool>('move');
  const [grab, setGrab] = useState<{ pick: Pick; base: Level; from: Point; live: Level } | null>(null);
  const [drag, setDrag] = useState<{ from: Point; to: Point } | null>(null);
  const [pendingVent, setPendingVent] = useState<Point | null>(null);
  const [isTrying, setIsTrying] = useState(false);
  const [beaten, setBeaten] = useState<Level | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  const named = useMemo(() => ({ ...level, name: name.trim() }), [level, name]);
  const isBeaten = beaten === level;

  const commit = (next: Level) => {
    if (next === level) return;
    setHistory((past) => [...past, next].slice(-50));
    setStatus(null);
  };

  // The page keeps its 360 x 600 shape and is letterboxed inside the space it gets, so the
  // pointer is mapped through the SVG's own screen matrix, not the element's box.
  const toWorld = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: clamp(point.x, WORLD.width), y: clamp(point.y, WORLD.height) };
  };

  const full = (what: string, count: number, max: number) => {
    if (count < max) return false;
    setStatus(`That’s the most ${what} a level can have.`);
    return true;
  };

  const handleTap = (at: Point) => {
    if (tool === 'bumper' && !full('stress balls', level.bumpers.length, LIMITS.bumpers)) {
      commit({ ...level, bumpers: [...level.bumpers, { ...at, r: BUMPER_RADIUS }] });
    } else if (tool === 'star' && !full('stars', level.stars.length, LIMITS.stars)) {
      commit({ ...level, stars: [...level.stars, at] });
    } else if (tool === 'vent') {
      if (!pendingVent) {
        if (!full('vents', level.portals.length, LIMITS.portals)) setPendingVent(at);
      } else {
        commit({ ...level, portals: [...level.portals, { a: pendingVent, b: at }] });
        setPendingVent(null);
      }
    } else if (tool === 'ball') {
      commit({ ...level, ball: at, walls: level.walls });
    } else if (tool === 'bin') {
      commit({ ...level, cup: at });
    } else if (tool === 'erase') {
      commit(erase(level, at));
    }
  };

  const handleDragEnd = (from: Point, to: Point) => {
    const length = dist(from, to);
    if (tool === 'shelf') {
      if (length < MIN_SHELF) return setStatus('Drag a longer line to draw a shelf.');
      if (full('shelves', level.walls.length, LIMITS.walls)) return;
      const angle = Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
      const folded = angle > 90 ? angle - 180 : angle < -90 ? angle + 180 : angle;
      commit({
        ...level,
        walls: [...level.walls, { x: Math.round((from.x + to.x) / 2), y: Math.round((from.y + to.y) / 2), w: Math.round(length), h: SHELF_THICKNESS, angle: folded }],
      });
    } else if (tool === 'fan') {
      if (full('fans', level.fans.length, LIMITS.fans)) return;
      const angle = length < 12 ? -90 : Math.round((Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI);
      commit({ ...level, fans: [...level.fans, { x: from.x, y: from.y, ...FAN_SIZE, angle }] });
    } else {
      handleTap(to);
    }
  };

  const share = async () => {
    if (!named.name) return setStatus('Give your level a name first.');
    setIsSharing(true);
    setStatus('Checking it can be beaten…');
    try {
      const response = await fetch('/api/levels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(named),
      });
      const body = (await response.json().catch(() => undefined)) as SubmitLevelResponse | ErrorResponse | undefined;
      if (!response.ok || !body || !('type' in body)) {
        throw new Error(body && 'message' in body ? body.message : 'Could not share your level.');
      }
      onShared();
    } catch (caught) {
      setStatus(caught instanceof Error ? caught.message : 'Could not share your level.');
    } finally {
      setIsSharing(false);
    }
  };

  const preview = drag && (tool === 'shelf' || tool === 'fan') ? drag : null;

  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-1.5 bg-felt px-2 py-2 text-ink" role="dialog" aria-label="Build a level">
      <div className="flex items-center gap-2">
        <input
          value={name}
          onChange={(event) => setName(event.target.value.slice(0, LIMITS.nameLength))}
          placeholder="Name your level"
          aria-label="Level name"
          className="min-w-0 flex-1 border-b-2 border-dashed border-ink/40 bg-transparent font-display text-2xl outline-none placeholder:text-ink-soft/60"
        />
        <SketchLink
          onClick={() => setHistory((past) => (past.length > 1 ? past.slice(0, -1) : past))}
          disabled={history.length < 2}
          className="disabled:opacity-30"
        >
          Undo
        </SketchLink>
        <SketchLink onClick={onClose}>Close</SketchLink>
      </div>
      {level.basedOn && <p className="-mt-1 text-sm text-ink-soft">Remix of a level by u/{level.basedOn}</p>}
      <div className="flex flex-wrap justify-center gap-0.5" role="radiogroup" aria-label="Tool">
        {TOOLS.map((option) => (
          <SketchChip
            key={option.id}
            role="radio"
            aria-checked={tool === option.id}
            isSelected={tool === option.id}
            onClick={() => {
              setTool(option.id);
              setPendingVent(null);
              setStatus(null);
            }}
          >
            <ToolIcon tool={option.id} />
            {option.label}
          </SketchChip>
        ))}
      </div>
      <div className="flex flex-wrap items-baseline justify-center gap-x-3 gap-y-1" role="radiogroup" aria-label="Rule">
        <span className="font-display text-base text-ink-soft">Rule</span>
        {([undefined, ...TWISTS] as (Twist | undefined)[]).map((option) => {
          const isOn = level.twist === option;
          const label = option ? TWIST_LABELS[option].name.replace(' day', '') : 'Normal';
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={isOn}
              title={option ? TWIST_LABELS[option].rule : 'Normal physics.'}
              onClick={() => {
                const { twist: _old, ...rest } = level;
                commit(option ? { ...rest, twist: option } : rest);
              }}
              className={`font-display text-base ${isOn ? 'text-coral underline underline-offset-4' : 'text-ink-soft'}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="relative min-h-0 flex-1">
        <LevelSketch level={grab?.live ?? level} withPaper className="pointer-events-none absolute inset-0 h-full w-full" />
        {/* Both layers letterbox the page the same way (xMidYMid meet), so they line up. */}
        <svg
          viewBox={`0 0 ${WORLD.width} ${WORLD.height}`}
          className="relative h-full w-full touch-none"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const at = toWorld(event);
            if (tool === 'move') {
              const pick = pickPiece(level, at);
              if (pick) setGrab({ pick, base: level, from: at, live: level });
              else setStatus('Grab a piece to move it, or pick a tool above to add one.');
              return;
            }
            setDrag({ from: at, to: at });
          }}
          onPointerMove={(event) => {
            if (grab) setGrab({ ...grab, live: movePiece(grab.base, grab.pick, grab.from, toWorld(event)) });
            else if (drag) setDrag({ ...drag, to: toWorld(event) });
          }}
          onPointerUp={(event) => {
            if (grab) {
              commit(movePiece(grab.base, grab.pick, grab.from, toWorld(event)));
              setGrab(null);
              return;
            }
            if (drag) handleDragEnd(drag.from, toWorld(event));
            setDrag(null);
          }}
        >
          {preview && (
            <line
              x1={preview.from.x}
              y1={preview.from.y}
              x2={preview.to.x}
              y2={preview.to.y}
              className="stroke-coral"
              strokeWidth="4"
              strokeDasharray="6 6"
              strokeLinecap="round"
            />
          )}
          {tool === 'move' &&
            (grab?.live ?? level).walls.flatMap((wall, index) => {
              const { a, b } = wallEnds(wall);
              return [a, b].map((end, j) => (
                <circle key={`${index}${j}`} cx={end.x} cy={end.y} r="9" className="fill-felt stroke-coral" strokeWidth="2.5" />
              ));
            })}
          {pendingVent && <circle cx={pendingVent.x} cy={pendingVent.y} r={PHYSICS.portalRadius} className="fill-none stroke-coral" strokeWidth="3" strokeDasharray="4 4" />}
        </svg>
      </div>
      <p className="min-h-5 text-center text-sm text-ink-soft" role="status">
        {status ??
          (pendingVent
            ? 'Now tap where the second vent goes.'
            : isBeaten
              ? 'You beat it. Share it with the subreddit.'
              : (TOOLS.find((option) => option.id === tool)?.hint ?? ''))}
      </p>
      <div className="flex justify-center gap-2">
        <SketchButton onClick={() => setIsTrying(true)}>{isBeaten ? 'Play again' : 'Beat it to share'}</SketchButton>
        <SketchButton tone="ink" disabled={!isBeaten || isSharing} onClick={() => void share()}>
          {isSharing ? 'Sharing…' : 'Share'}
        </SketchButton>
      </div>
      {isTrying && (
        <TryLevel
          level={named.name ? named : { ...named, name: 'Your level' }}
          title={named.name || 'Your level'}
          arts={arts}
          username={username}
          onSunk={() => setBeaten(level)}
          onClose={() => setIsTrying(false)}
        />
      )}
    </div>
  );
}
