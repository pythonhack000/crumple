import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BallArtResponse, ErrorResponse } from '../../shared/api';
import { MATERIALS } from '../../shared/ball-art';
import type { Material } from '../../shared/ball-art';
import { drawMaterialBase, drawOutline, exportBall, shapePath } from './ballArt';
import { SketchButton } from './Sketchy';
import { MATERIAL_LABELS } from './theme';

const CANVAS = 240;
/** The drawing alone (no material), kept in this browser so it can be edited again. */
const STROKES_KEY = 'crumple-ball-strokes';

function readStrokes(): string | null {
  try {
    return window.localStorage.getItem(STROKES_KEY);
  } catch {
    return null;
  }
}

function writeStrokes(canvas: HTMLCanvasElement) {
  try {
    window.localStorage.setItem(STROKES_KEY, canvas.toDataURL('image/png'));
  } catch {
    // Not kept for next time; the saved ball itself is unaffected.
  }
}

type Tool = {
  id: string;
  label: string;
  color: string;
  width: number;
  alpha: number;
  erase?: boolean;
};

const TOOLS: Tool[] = [
  { id: 'ballpoint', label: 'Ballpoint', color: '#22408f', width: 4, alpha: 1 },
  { id: 'red', label: 'Red pen', color: '#e2452f', width: 4, alpha: 1 },
  { id: 'marker', label: 'Marker', color: '#1b1b1f', width: 12, alpha: 1 },
  { id: 'highlighter', label: 'Highlighter', color: '#f6d21c', width: 24, alpha: 0.45 },
  { id: 'felt', label: 'Felt tip', color: '#2f9e6a', width: 8, alpha: 1 },
  { id: 'eraser', label: 'Eraser', color: '#000', width: 26, alpha: 1, erase: true },
];

const STAMPS = ['star', 'heart', 'eyes', 'grin'] as const;
type Stamp = (typeof STAMPS)[number];

/** A doodle of each tool, lying at an angle on the page. */
function ToolDoodle({ tool }: { tool: Tool }) {
  if (tool.erase) {
    return (
      <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
        <g transform="rotate(-35 20 20)">
          <rect x="8" y="14" width="24" height="12" rx="2" fill="#f4a7b9" stroke="#22408f" strokeWidth="1.6" />
          <line x1="16" y1="14" x2="16" y2="26" stroke="#22408f" strokeWidth="1.2" />
        </g>
      </svg>
    );
  }
  const body = tool.id === 'marker' || tool.id === 'highlighter' ? 9 : tool.id === 'felt' ? 7 : 5;
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10" aria-hidden="true">
      <g transform="rotate(-40 20 20)">
        <rect x="6" y={20 - body / 2} width="24" height={body} rx="1.5" fill={tool.id === 'highlighter' ? '#f6d21c' : '#fbfaf6'} stroke="#22408f" strokeWidth="1.5" />
        <path d={`M30 ${20 - body / 2} L36 20 L30 ${20 + body / 2} Z`} fill={tool.color} stroke="#22408f" strokeWidth="1.2" strokeLinejoin="round" />
        <rect x="6" y={20 - body / 2} width="5" height={body} fill={tool.color} opacity={tool.id === 'highlighter' ? 0.6 : 1} />
      </g>
    </svg>
  );
}

function StampDoodle({ stamp }: { stamp: Stamp }) {
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden="true">
      {stamp === 'star' && <path d="M16 4 L19 12 L28 12.5 L21 18 L23.5 27 L16 22 L8.5 27 L11 18 L4 12.5 L13 12 Z" fill="none" stroke="#e2452f" strokeWidth="2" strokeLinejoin="round" />}
      {stamp === 'heart' && <path d="M16 27 C 6 19, 4 13, 8 9 C 11 6, 15 8, 16 11 C 17 8, 21 6, 24 9 C 28 13, 26 19, 16 27 Z" fill="#e2452f" stroke="#22408f" strokeWidth="1.2" />}
      {stamp === 'eyes' && (
        <g>
          <ellipse cx="11" cy="16" rx="4" ry="5.5" fill="#1b1b1f" />
          <ellipse cx="21" cy="16" rx="4" ry="5.5" fill="#1b1b1f" />
          <circle cx="12.3" cy="14" r="1.4" fill="#fff" />
          <circle cx="22.3" cy="14" r="1.4" fill="#fff" />
        </g>
      )}
      {stamp === 'grin' && <path d="M7 13 C 10 24, 22 24, 25 13" fill="none" stroke="#1b1b1f" strokeWidth="2.6" strokeLinecap="round" />}
    </svg>
  );
}

/** Draws a stamp at (x, y) on the stroke layer. */
function stampAt(g: CanvasRenderingContext2D, stamp: Stamp, x: number, y: number) {
  g.save();
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.translate(x, y);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (stamp === 'star') {
    g.strokeStyle = '#e2452f';
    g.lineWidth = 4;
    g.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const radius = i % 2 === 0 ? 26 : 11;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    g.closePath();
    g.stroke();
  } else if (stamp === 'heart') {
    g.fillStyle = '#e2452f';
    g.strokeStyle = '#22408f';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(0, 24);
    g.bezierCurveTo(-24, 6, -26, -14, -10, -18);
    g.bezierCurveTo(-4, -19, 0, -12, 0, -8);
    g.bezierCurveTo(0, -12, 4, -19, 10, -18);
    g.bezierCurveTo(26, -14, 24, 6, 0, 24);
    g.fill();
    g.stroke();
  } else if (stamp === 'eyes') {
    for (const dx of [-22, 22]) {
      g.fillStyle = '#1b1b1f';
      g.beginPath();
      g.ellipse(dx, 0, 11, 15, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(dx + 4, -5, 4, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    g.strokeStyle = '#1b1b1f';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(-40, -6);
    g.bezierCurveTo(-26, 30, 26, 30, 40, -6);
    g.stroke();
  }
  g.restore();
}

type BallEditorProps = {
  current: string | null;
  material: Material;
  onClose: () => void;
  onSaved: (art: string | null, material: Material) => void;
};

/** The ball maker, drawn as a notebook page with pens lying on it. */
export function BallEditor({ current, material: startMaterial, onClose, onSaved }: BallEditorProps) {
  const base = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [material, setMaterial] = useState<Material>(startMaterial);
  const [tool, setTool] = useState<Tool>(TOOLS[0]!);
  const [stamp, setStamp] = useState<Stamp | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const g = base.current?.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, CANVAS, CANVAS);
    drawMaterialBase(g, material, CANVAS / 2);
    drawOutline(g, CANVAS / 2, 3, material);
  }, [material]);

  useEffect(() => {
    // Only the drawing layer is reloaded, never the saved ball: that one has the old
    // material baked in and would sit on top of a newly chosen one.
    const g = strokes.current?.getContext('2d');
    const saved = current ? readStrokes() : null;
    if (!g || !saved) return;
    const image = new Image();
    image.onload = () => g.drawImage(image, 0, 0, CANVAS, CANVAS);
    image.src = saved;
  }, [current]);

  const toCanvas = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * CANVAS, y: ((event.clientY - rect.top) / rect.height) * CANVAS };
  };

  const draw = (to: { x: number; y: number }) => {
    const g = strokes.current?.getContext('2d');
    if (!g) return;
    const from = last.current ?? to;
    g.save();
    shapePath(g, material, CANVAS / 2, 3);
    g.clip();
    g.globalCompositeOperation = tool.erase ? 'destination-out' : 'source-over';
    g.globalAlpha = tool.alpha;
    g.strokeStyle = tool.color;
    g.lineWidth = tool.width;
    g.lineCap = tool.id === 'highlighter' ? 'square' : 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(from.x, from.y);
    // Ballpoint lines wobble a touch, like a real pen.
    const wobble = tool.id === 'ballpoint' || tool.id === 'red' ? 0.6 : 0;
    g.lineTo(to.x + (Math.random() - 0.5) * wobble, to.y + (Math.random() - 0.5) * wobble);
    g.stroke();
    g.restore();
    last.current = to;
  };

  const handleDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const at = toCanvas(event);
    if (stamp) {
      const g = strokes.current?.getContext('2d');
      if (g) stampAt(g, stamp, at.x, at.y);
      return;
    }
    last.current = null;
    draw(at);
  };

  const clear = () => strokes.current?.getContext('2d')?.clearRect(0, 0, CANVAS, CANVAS);

  const save = async () => {
    if (!strokes.current) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/ball', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art: exportBall(strokes.current, material), material }),
      });
      const body = (await response.json().catch(() => undefined)) as BallArtResponse | ErrorResponse | undefined;
      if (!response.ok || !body || !('type' in body)) {
        throw new Error(body && 'message' in body ? body.message : 'Could not save your ball.');
      }
      writeStrokes(strokes.current);
      onSaved(body.art, body.material);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your ball.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center gap-3 overflow-y-auto px-4 py-3 text-ink"
      style={{
        background:
          'linear-gradient(90deg, transparent 25px, #f3c6c0 25px, #f3c6c0 26.5px, transparent 26.5px), repeating-linear-gradient(#fbfaf6 0 23px, #d4e2f3 23px 24px)',
      }}
      role="dialog"
      aria-label="Make your ball"
    >
      <div className="flex w-full items-baseline justify-between pl-6">
        <h2 className="-rotate-1 font-display text-3xl">Make your ball</h2>
        <button type="button" onClick={onClose} className="font-display text-lg underline decoration-dotted underline-offset-4">
          Close
        </button>
      </div>

      <div className="relative h-60 w-60 shrink-0">
        <canvas ref={base} width={CANVAS} height={CANVAS} className="absolute inset-0 h-full w-full" />
        <canvas
          ref={strokes}
          width={CANVAS}
          height={CANVAS}
          className="absolute inset-0 h-full w-full touch-none"
          aria-label="Your ball. Draw on it."
          onPointerDown={handleDown}
          onPointerMove={(event) => {
            if (event.buttons && !stamp) draw(toCanvas(event));
          }}
          onPointerUp={() => {
            last.current = null;
          }}
        />
      </div>

      <div className="flex gap-3" role="radiogroup" aria-label="What it’s made of">
        {MATERIALS.map((option) => (
          <MaterialChoice key={option} material={option} isSelected={material === option} onPick={() => setMaterial(option)} />
        ))}
      </div>

      <div className="flex flex-wrap items-end justify-center gap-1" role="radiogroup" aria-label="Pens">
        {TOOLS.map((option) => {
          const isOn = !stamp && tool.id === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={isOn}
              aria-label={option.label}
              title={option.label}
              onClick={() => {
                setTool(option);
                setStamp(null);
              }}
              className={`relative flex flex-col items-center transition-transform ${isOn ? '-translate-y-1.5' : 'opacity-75'}`}
            >
              <ToolDoodle tool={option} />
              {isOn && <span className="absolute -bottom-1 h-0.5 w-7 rounded-full bg-coral" />}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2" role="radiogroup" aria-label="Stamps">
        <span className="font-display text-base text-ink-soft">Stamps</span>
        {STAMPS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={stamp === option}
            aria-label={`${option} stamp`}
            onClick={() => setStamp(stamp === option ? null : option)}
            className={`rounded-full p-1 transition-transform ${stamp === option ? 'scale-125 ring-2 ring-coral' : ''}`}
          >
            <StampDoodle stamp={option} />
          </button>
        ))}
      </div>
      <p className="-mt-1 text-center text-sm text-ink-soft">
        {stamp ? 'Tap the ball to stamp it.' : 'Draw on the ball. It changes the look and the sound, never the throw.'}
      </p>

      {error && (
        <p role="alert" className="text-center text-sm text-coral">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2 pb-2">
        <SketchButton tone="ink" disabled={isSaving} onClick={() => void save()}>
          {isSaving ? 'Saving…' : 'Use this ball'}
        </SketchButton>
        <SketchButton onClick={clear}>Start over</SketchButton>
      </div>
    </div>
  );
}

/** A doodled ball of one material, circled in red pen when chosen. */
function MaterialChoice({ material, isSelected, onPick }: { material: Material; isSelected: boolean; onPick: () => void }) {
  const preview = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = preview.current?.getContext('2d');
    if (!g) return;
    drawMaterialBase(g, material, 24);
    drawOutline(g, 24, 2.5, material);
  }, [material]);
  return (
    <button type="button" role="radio" aria-checked={isSelected} onClick={onPick} className="relative flex flex-col items-center font-display text-base">
      <canvas ref={preview} width={48} height={48} className="h-12 w-12" />
      <span className={isSelected ? 'text-coral' : 'text-ink-soft'}>{MATERIAL_LABELS[material]}</span>
      {isSelected && (
        <svg viewBox="0 0 80 80" className="pointer-events-none absolute -top-3 h-[4.6rem] w-[4.6rem]" aria-hidden="true">
          <path d="M40 6 C 64 5, 76 22, 74 40 C 72 60, 56 74, 38 73 C 18 72, 5 58, 6 39 C 7 20, 22 7, 44 8" fill="none" stroke="#e2452f" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
