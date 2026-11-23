import { useEffect, useRef, useState } from 'react';
import type { BallArtResponse, ErrorResponse } from '../../shared/api';
import { MATERIALS } from '../../shared/ball-art';
import type { Material } from '../../shared/ball-art';
import { SketchButton } from './Sketchy';
import { MATERIAL_LABELS } from './theme';
import type { BallScene } from './workshop/ballScene';

const PENS = ['#22408f', '#f2553a', '#1b1b1f', '#ffffff', '#f6c21c', '#2f9e6a'] as const;
const BRUSHES = [8, 16, 30] as const;

type BallEditorProps = {
  current: string | null;
  material: Material;
  onClose: () => void;
  onSaved: (art: string | null, material: Material) => void;
};

/** The ball workshop: a lit 3D ball you paint on directly. */
export function BallEditor({ current, material: startMaterial, onClose, onSaved }: BallEditorProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<BallScene | null>(null);
  const [material, setMaterial] = useState<Material>(startMaterial);
  const [pen, setPen] = useState<string>(PENS[0]);
  const [isErasing, setIsErasing] = useState(false);
  const [brush, setBrush] = useState<number>(BRUSHES[1]);
  const [previews, setPreviews] = useState<Partial<Record<Material, string>>>({});
  const [isReady, setIsReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        const [{ createBallScene }, art] = await Promise.all([
          import('./workshop/ballScene'),
          current
            ? new Promise<HTMLImageElement | null>((resolve) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => resolve(null);
                image.src = current;
              })
            : Promise.resolve(null),
        ]);
        if (!isActive || !canvas.current) return;
        const ball = createBallScene(canvas.current, startMaterial, art);
        scene.current = ball;
        // Real renders of each material for the picker.
        const shots: Partial<Record<Material, string>> = {};
        for (const option of MATERIALS) {
          ball.setMaterial(option);
          shots[option] = ball.snapshot();
        }
        ball.setMaterial(startMaterial);
        setPreviews(shots);
        setIsReady(true);
      } catch (caught) {
        console.error('The ball workshop could not start', caught);
        if (isActive) setError('This device can’t show the 3D workshop. Try another browser.');
      }
    })();
    return () => {
      isActive = false;
      scene.current?.dispose();
      scene.current = null;
    };
    // The 3D scene is built once; later changes go through the scene's setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pickMaterial = (next: Material) => {
    setMaterial(next);
    scene.current?.setMaterial(next);
  };
  const pickPen = (color: string) => {
    setPen(color);
    setIsErasing(false);
    scene.current?.setPen(color);
  };
  const pickEraser = () => {
    setIsErasing(true);
    scene.current?.setEraser();
  };
  const pickBrush = (size: number) => {
    setBrush(size);
    scene.current?.setBrush(size);
  };

  const save = async () => {
    const art = scene.current?.snapshot();
    if (!art) return;
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/ball', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ art, material }),
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
    <div className="absolute inset-0 z-10 flex flex-col items-center gap-3 overflow-y-auto bg-felt px-4 py-3 text-ink" role="dialog" aria-label="Ball workshop">
      <div className="flex w-full items-baseline justify-between">
        <h2 className="-rotate-1 font-display text-3xl">Ball workshop</h2>
        <button type="button" onClick={onClose} className="font-display text-lg underline decoration-dotted underline-offset-4">
          Close
        </button>
      </div>
      <div className="relative aspect-square w-full max-w-[19rem]">
        <canvas ref={canvas} className="h-full w-full touch-none" aria-label="Your ball. Draw on it, or drag beside it to turn it." />
        {!isReady && !error && (
          <p className="absolute inset-0 flex items-center justify-center font-display text-xl text-ink-soft">Rolling out the ball…</p>
        )}
      </div>
      <p className="-mt-2 text-center text-sm text-ink-soft">Draw on the ball. Drag beside it to turn it.</p>

      <div className="flex gap-3" role="radiogroup" aria-label="Material">
        {MATERIALS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={material === option}
            onClick={() => pickMaterial(option)}
            className={`flex flex-col items-center gap-0.5 font-display text-base transition-transform ${material === option ? 'scale-110 text-coral' : 'text-ink-soft'}`}
          >
            {previews[option] ? (
              <img src={previews[option]} alt="" className="h-12 w-12 drop-shadow-[0_3px_3px_rgba(34,64,143,0.25)]" />
            ) : (
              <span className="h-12 w-12" />
            )}
            {MATERIAL_LABELS[option]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2" role="radiogroup" aria-label="Pen">
        {PENS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={!isErasing && pen === color}
            aria-label={`Pen ${color}`}
            onClick={() => pickPen(color)}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${!isErasing && pen === color ? 'scale-125 border-ink' : 'border-ink/25'}`}
            style={{ background: color }}
          />
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={isErasing}
          aria-label="Eraser"
          onClick={pickEraser}
          className={`h-8 rounded-full border-2 px-2 font-display text-sm ${isErasing ? 'border-ink text-coral' : 'border-ink/25 text-ink-soft'}`}
        >
          Eraser
        </button>
      </div>
      <div className="flex items-center gap-4" role="radiogroup" aria-label="Brush size">
        {BRUSHES.map((size) => (
          <button
            key={size}
            type="button"
            role="radio"
            aria-checked={brush === size}
            aria-label={`Brush ${size}`}
            onClick={() => pickBrush(size)}
            className="flex h-8 w-8 items-center justify-center"
          >
            <span className={`rounded-full ${brush === size ? 'bg-coral' : 'bg-ink/40'}`} style={{ width: 4 + size / 2.4, height: 4 + size / 2.4 }} />
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-center text-sm text-coral">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2 pb-2">
        <SketchButton tone="ink" disabled={!isReady || isSaving} onClick={() => void save()}>
          {isSaving ? 'Saving…' : 'Use this ball'}
        </SketchButton>
        <SketchButton disabled={!isReady} onClick={() => scene.current?.clear()}>
          Start over
        </SketchButton>
      </div>
    </div>
  );
}
