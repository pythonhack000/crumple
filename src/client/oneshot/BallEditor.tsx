import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BallArtResponse, ErrorResponse } from '../../shared/api';
import { BALL_ART, MATERIALS } from '../../shared/ball-art';
import type { Material } from '../../shared/ball-art';
import { MATERIAL_COLORS, MATERIAL_LABELS } from './theme';
import { SketchButton } from './Sketchy';

const CANVAS = 192;
const BRUSH = 9;
const PENS = [
  { name: 'Blue pen', color: '#22408f' },
  { name: 'Red pen', color: '#f2553a' },
  { name: 'Black pen', color: '#1b1b1f' },
  { name: 'Eraser', color: 'erase' },
] as const;

/** Shrinks the drawing, laid over the material, to a small round PNG. */
function exportArt(source: HTMLCanvasElement, material: Material): string {
  const out = document.createElement('canvas');
  out.width = BALL_ART.size;
  out.height = BALL_ART.size;
  const context = out.getContext('2d');
  if (!context) return '';
  context.beginPath();
  context.arc(BALL_ART.size / 2, BALL_ART.size / 2, BALL_ART.size / 2, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = MATERIAL_COLORS[material];
  context.fillRect(0, 0, BALL_ART.size, BALL_ART.size);
  context.drawImage(source, 0, 0, BALL_ART.size, BALL_ART.size);
  // A pen outline so the ball reads on paper.
  context.strokeStyle = '#22408f';
  context.lineWidth = 4;
  context.beginPath();
  context.arc(BALL_ART.size / 2, BALL_ART.size / 2, BALL_ART.size / 2 - 2, 0, Math.PI * 2);
  context.stroke();
  return out.toDataURL('image/png');
}

type BallEditorProps = {
  current: string | null;
  material: Material;
  onClose: () => void;
  onSaved: (art: string | null, material: Material) => void;
};

export function BallEditor({ current, material: startMaterial, onClose, onSaved }: BallEditorProps) {
  const [material, setMaterial] = useState<Material>(startMaterial);
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [pen, setPen] = useState<string>(PENS[0].color);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    if (!current) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, CANVAS, CANVAS);
    image.src = current;
  }, [current]);

  const toCanvas = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * CANVAS, y: ((event.clientY - rect.top) / rect.height) * CANVAS };
  };

  const stroke = (to: { x: number; y: number }) => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    const from = last.current ?? to;
    context.save();
    context.beginPath();
    context.arc(CANVAS / 2, CANVAS / 2, CANVAS / 2 - 2, 0, Math.PI * 2);
    context.clip();
    const isEraser = pen === PENS[3].color;
    context.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    context.strokeStyle = isEraser ? '#000' : pen;
    context.lineWidth = isEraser ? BRUSH * 2.5 : BRUSH;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.restore();
    last.current = to;
  };

  const handleClear = () => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, CANVAS, CANVAS);
  };

  const save = async (art: string | null) => {
    const chosen = material;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/ball', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art, material: chosen }),
      });
      const body = (await response.json().catch(() => undefined)) as BallArtResponse | ErrorResponse | undefined;
      if (!response.ok || !body || !('type' in body)) {
        throw new Error(body && 'message' in body ? body.message : 'Could not save your ball.');
      }
      onSaved(body.art, body.material);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your ball.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-felt/95 p-5 text-ink" role="dialog" aria-label="Draw your ball">
      <h2 className="-rotate-1 font-display text-3xl">Make your ball</h2>
      <p className="max-w-xs text-center text-sm text-ink-soft">
        Pick what it’s made of, then draw on it. It changes how it looks and sounds, not how it flies.
      </p>
      <canvas
        ref={canvas}
        width={CANVAS}
        height={CANVAS}
        className="h-48 w-48 touch-none rounded-full border-2 border-dashed border-ink/50"
        style={{ background: MATERIAL_COLORS[material] }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          last.current = null;
          stroke(toCanvas(event));
        }}
        onPointerMove={(event) => {
          if (event.buttons) stroke(toCanvas(event));
        }}
        onPointerUp={() => {
          last.current = null;
        }}
      />
      <div className="flex gap-2" role="radiogroup" aria-label="Material">
        {MATERIALS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={material === option}
            onClick={() => setMaterial(option)}
            className={`flex flex-col items-center gap-1 font-display text-sm ${material === option ? 'text-coral' : 'text-ink-soft'}`}
          >
            <span
              className={`h-8 w-8 rounded-full border-2 ${material === option ? 'border-coral' : 'border-ink/30'}`}
              style={{ background: MATERIAL_COLORS[option] }}
            />
            {MATERIAL_LABELS[option]}
          </button>
        ))}
      </div>
      <div className="flex gap-3" role="radiogroup" aria-label="Pen">
        {PENS.map((option) => (
          <button
            key={option.name}
            type="button"
            role="radio"
            aria-checked={pen === option.color}
            aria-label={option.name}
            onClick={() => setPen(option.color)}
            className={`h-10 w-10 rounded-full border-2 ${pen === option.color ? 'border-ink scale-110' : 'border-ink/25'}`}
            style={{ background: option.color === 'erase' ? 'repeating-linear-gradient(45deg,#fbfaf6 0 4px,#d4e2f3 4px 8px)' : option.color }}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <SketchButton tone="ink" disabled={isSaving} onClick={() => canvas.current && void save(exportArt(canvas.current, material))}>
          {isSaving ? 'Saving…' : 'Use this ball'}
        </SketchButton>
        <SketchButton onClick={handleClear}>Clear</SketchButton>
        <SketchButton onClick={() => void save(null)}>No drawing</SketchButton>
        <SketchButton onClick={onClose}>Cancel</SketchButton>
      </div>
    </div>
  );
}
