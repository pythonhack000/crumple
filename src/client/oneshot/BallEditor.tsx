import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { BallArtResponse, ErrorResponse } from '../../shared/api';
import { BALL_ART } from '../../shared/ball-art';
import { SketchButton } from './Sketchy';

const CANVAS = 192;
const BRUSH = 9;
const PENS = [
  { name: 'Blue pen', color: '#22408f' },
  { name: 'Red pen', color: '#f2553a' },
  { name: 'Black pen', color: '#1b1b1f' },
  { name: 'Eraser', color: '#fbfaf6' },
] as const;

function paintPaper(context: CanvasRenderingContext2D) {
  context.fillStyle = '#fbfaf6';
  context.beginPath();
  context.arc(CANVAS / 2, CANVAS / 2, CANVAS / 2 - 2, 0, Math.PI * 2);
  context.fill();
}

/** Shrinks the drawing to a small round PNG. */
function exportArt(source: HTMLCanvasElement): string {
  const out = document.createElement('canvas');
  out.width = BALL_ART.size;
  out.height = BALL_ART.size;
  const context = out.getContext('2d');
  if (!context) return '';
  context.beginPath();
  context.arc(BALL_ART.size / 2, BALL_ART.size / 2, BALL_ART.size / 2, 0, Math.PI * 2);
  context.clip();
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
  onClose: () => void;
  onSaved: (art: string | null) => void;
};

export function BallEditor({ current, onClose, onSaved }: BallEditorProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [pen, setPen] = useState<string>(PENS[0].color);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const context = canvas.current?.getContext('2d');
    if (!context) return;
    paintPaper(context);
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
    context.strokeStyle = pen;
    context.lineWidth = pen === PENS[3].color ? BRUSH * 2.5 : BRUSH;
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
    paintPaper(context);
  };

  const save = async (art: string | null) => {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/ball', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art }),
      });
      const body = (await response.json().catch(() => undefined)) as BallArtResponse | ErrorResponse | undefined;
      if (!response.ok || !body || !('type' in body)) {
        throw new Error(body && 'message' in body ? body.message : 'Could not save your ball.');
      }
      onSaved(body.art);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save your ball.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-felt/95 p-5 text-ink" role="dialog" aria-label="Draw your ball">
      <h2 className="-rotate-1 font-display text-3xl">Draw your ball</h2>
      <p className="max-w-xs text-center text-sm text-ink-soft">
        Everyone sees it: it’s what you throw, and what’s left on the table when you miss.
      </p>
      <canvas
        ref={canvas}
        width={CANVAS}
        height={CANVAS}
        className="h-48 w-48 touch-none rounded-full border-2 border-dashed border-ink/50"
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
            style={{ background: option.color }}
          />
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-coral">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2">
        <SketchButton tone="ink" disabled={isSaving} onClick={() => canvas.current && void save(exportArt(canvas.current))}>
          {isSaving ? 'Saving…' : 'Use this ball'}
        </SketchButton>
        <SketchButton onClick={handleClear}>Clear</SketchButton>
        {current && <SketchButton onClick={() => void save(null)}>Plain paper</SketchButton>}
        <SketchButton onClick={onClose}>Cancel</SketchButton>
      </div>
    </div>
  );
}
