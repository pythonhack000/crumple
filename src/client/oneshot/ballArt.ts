import type { Material } from '../../shared/ball-art';
import { BALL_ART } from '../../shared/ball-art';

const INK = '#22408f';

/** Paints a material's look into a circle of radius r at (r, r), in the notebook style. */
export function drawMaterialBase(g: CanvasRenderingContext2D, material: Material, r: number) {
  g.save();
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.clip();
  const line = (x1: number, y1: number, x2: number, y2: number, color: string, width: number) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
    g.stroke();
  };
  if (material === 'paper') {
    g.fillStyle = '#f3efe4';
    g.fillRect(0, 0, r * 2, r * 2);
    // Crumple creases and a soft shadow on one side.
    g.fillStyle = 'rgba(34,64,143,0.07)';
    g.beginPath();
    g.moveTo(r * 2, r * 0.6);
    g.lineTo(r * 1.1, r * 2);
    g.lineTo(r * 2, r * 2);
    g.fill();
    const creases = [
      [0.25, 0.35, 0.8, 0.55],
      [0.55, 0.2, 0.7, 0.95],
      [0.2, 0.75, 0.6, 0.6],
      [1.2, 0.4, 1.7, 0.9],
      [1.0, 1.3, 1.6, 1.15],
      [0.4, 1.4, 0.9, 1.75],
      [1.3, 1.5, 1.45, 1.85],
    ];
    for (const [a, b, c, d] of creases) line(a! * r, b! * r, c! * r, d! * r, 'rgba(34,64,143,0.32)', r * 0.025);
  } else if (material === 'rubber') {
    g.fillStyle = '#f2553a';
    g.fillRect(0, 0, r * 2, r * 2);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath();
    g.arc(r * 1.25, r * 1.25, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = r * 0.12;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(r, r, r * 0.62, Math.PI * 1.1, Math.PI * 1.45);
    g.stroke();
  } else if (material === 'tin') {
    g.fillStyle = '#c7ced8';
    g.fillRect(0, 0, r * 2, r * 2);
    for (let y = r * 0.2; y < r * 2; y += r * 0.28) line(0, y, r * 2, y + r * 0.04, 'rgba(34,64,143,0.35)', r * 0.03);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(r * 0.35, 0, r * 0.18, r * 2);
  } else {
    g.fillStyle = '#dcefff';
    g.fillRect(0, 0, r * 2, r * 2);
    // The colour swirl inside a marble.
    g.strokeStyle = 'rgba(47,158,106,0.7)';
    g.lineWidth = r * 0.12;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(r * 0.45, r * 1.35);
    g.bezierCurveTo(r * 0.8, r * 0.6, r * 1.3, r * 1.6, r * 1.6, r * 0.75);
    g.stroke();
    g.strokeStyle = 'rgba(242,85,58,0.6)';
    g.lineWidth = r * 0.07;
    g.beginPath();
    g.moveTo(r * 0.55, r * 1.55);
    g.bezierCurveTo(r * 0.95, r * 0.9, r * 1.35, r * 1.8, r * 1.55, r * 1.05);
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.ellipse(r * 0.65, r * 0.6, r * 0.18, r * 0.11, -0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** A hand-drawn ink circle around the ball. */
export function drawOutline(g: CanvasRenderingContext2D, r: number, width: number) {
  g.strokeStyle = INK;
  g.lineWidth = width;
  g.beginPath();
  g.arc(r, r, r - width / 2, 0, Math.PI * 2);
  g.stroke();
}

/** Flattens material, drawing and outline into a small round PNG for the game. */
export function exportBall(strokes: HTMLCanvasElement, material: Material): string {
  const size = BALL_ART.size;
  const out = document.createElement('canvas');
  out.width = size;
  out.height = size;
  const g = out.getContext('2d');
  if (!g) return '';
  drawMaterialBase(g, material, size / 2);
  g.save();
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  g.clip();
  g.drawImage(strokes, 0, 0, size, size);
  g.restore();
  drawOutline(g, size / 2, size * 0.05);
  return out.toDataURL('image/png');
}
