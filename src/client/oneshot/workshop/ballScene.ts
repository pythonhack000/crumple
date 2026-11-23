import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Material } from '../../../shared/ball-art';
import { BALL_ART } from '../../../shared/ball-art';

const PAINT_W = 1024;
const PAINT_H = 512;
const BASE: Record<Material, string> = { paper: '#e9e3d4', rubber: '#f2553a', tin: '#c3cad4', glass: '#dcefff' };
const AUTO_SPIN = 0.0035;

/** Cheap smooth noise for crumpling the paper ball. */
function crumple(x: number, y: number, z: number): number {
  return (
    Math.sin(x * 6.1 + y * 2.3) * 0.5 +
    Math.sin(y * 7.7 - z * 3.1) * 0.35 +
    Math.sin(z * 9.3 + x * 4.7) * 0.25 +
    Math.sin((x + y + z) * 13.1) * 0.15
  );
}

function makeGeometry(material: Material): THREE.SphereGeometry {
  const geometry = new THREE.SphereGeometry(1, 128, 64);
  if (material !== 'paper') return geometry;
  const position = geometry.attributes.position;
  if (!position) return geometry;
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    v.fromBufferAttribute(position, i);
    const n = crumple(v.x, v.y, v.z);
    v.multiplyScalar(1 + n * 0.085);
    position.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function ribTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const g = canvas.getContext('2d');
  if (g) {
    for (let y = 0; y < 256; y += 1) {
      const v = 128 + 127 * Math.sin((y / 256) * Math.PI * 2 * 9);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(0, y, 64, 1);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

function makeMaterial(material: Material, map: THREE.Texture): THREE.Material {
  switch (material) {
    case 'paper':
      return new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0 });
    case 'rubber':
      return new THREE.MeshPhysicalMaterial({ map, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.25 });
    case 'tin':
      return new THREE.MeshStandardMaterial({ map, metalness: 0.95, roughness: 0.28, bumpMap: ribTexture(), bumpScale: 1.4 });
    case 'glass':
      return new THREE.MeshPhysicalMaterial({
        map,
        transmission: 0.7,
        thickness: 1.2,
        roughness: 0.02,
        ior: 1.5,
        attenuationColor: new THREE.Color('#7fb8ea'),
        attenuationDistance: 1.5,
        iridescence: 1,
        iridescenceIOR: 1.35,
        sheen: 0.4,
        sheenColor: new THREE.Color('#b9e2ff'),
        clearcoat: 1,
        transparent: true,
      });
  }
}

export type BallScene = ReturnType<typeof createBallScene>;

/**
 * A spinning, lit 3D ball you can paint on. Pointer on the ball paints;
 * pointer off the ball turns it.
 */
export function createBallScene(canvas: HTMLCanvasElement, start: Material, startArt: HTMLImageElement | null) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 4.4);
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-2, 3, 4);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.15));

  // The paint layer: drawn strokes over the material's base colour.
  const paint = document.createElement('canvas');
  paint.width = PAINT_W;
  paint.height = PAINT_H;
  const strokes = document.createElement('canvas');
  strokes.width = PAINT_W;
  strokes.height = PAINT_H;
  const paintContext = paint.getContext('2d');
  const strokeContext = strokes.getContext('2d');
  const texture = new THREE.CanvasTexture(paint);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  let material = start;
  const ball = new THREE.Mesh(makeGeometry(material), makeMaterial(material, texture));
  scene.add(ball);

  const compose = () => {
    if (!paintContext) return;
    paintContext.fillStyle = BASE[material];
    paintContext.fillRect(0, 0, PAINT_W, PAINT_H);
    paintContext.drawImage(strokes, 0, 0);
    texture.needsUpdate = true;
  };
  if (startArt && strokeContext) {
    // An existing flat drawing goes on the front of the ball.
    strokeContext.drawImage(startArt, PAINT_W * 0.25 - PAINT_H * 0.4, PAINT_H * 0.1, PAINT_H * 0.8, PAINT_H * 0.8);
  }
  compose();

  let pen = '#22408f';
  let brush = 14;
  let isErasing = false;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let lastUv: THREE.Vector2 | null = null;
  let turning: { x: number; y: number } | null = null;
  let spin = AUTO_SPIN;

  const hitUv = (clientX: number, clientY: number): THREE.Vector2 | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(ball)[0];
    return hit?.uv ?? null;
  };

  const dab = (from: THREE.Vector2, to: THREE.Vector2) => {
    if (!strokeContext) return;
    strokeContext.globalCompositeOperation = isErasing ? 'destination-out' : 'source-over';
    strokeContext.strokeStyle = pen;
    strokeContext.lineCap = 'round';
    strokeContext.lineJoin = 'round';
    strokeContext.lineWidth = brush;
    // Draw three times across the seam so strokes wrap around the ball.
    for (const shift of [-PAINT_W, 0, PAINT_W]) {
      strokeContext.beginPath();
      strokeContext.moveTo(from.x * PAINT_W + shift, (1 - from.y) * PAINT_H);
      strokeContext.lineTo(to.x * PAINT_W + shift, (1 - to.y) * PAINT_H);
      strokeContext.stroke();
    }
    compose();
  };

  const onDown = (event: PointerEvent) => {
    canvas.setPointerCapture(event.pointerId);
    const uv = hitUv(event.clientX, event.clientY);
    if (uv) {
      spin = 0;
      lastUv = uv.clone();
      dab(uv, uv);
    } else {
      turning = { x: event.clientX, y: event.clientY };
    }
  };
  const onMove = (event: PointerEvent) => {
    if (turning) {
      ball.rotation.y += (event.clientX - turning.x) * 0.012;
      ball.rotation.x = THREE.MathUtils.clamp(ball.rotation.x + (event.clientY - turning.y) * 0.012, -1.2, 1.2);
      turning = { x: event.clientX, y: event.clientY };
      return;
    }
    if (!lastUv || !event.buttons) return;
    const uv = hitUv(event.clientX, event.clientY);
    if (!uv) return;
    // Across the seam the stroke would jump the whole texture; start a new one.
    if (Math.abs(uv.x - lastUv.x) < 0.5) dab(lastUv, uv);
    lastUv = uv.clone();
  };
  const onUp = () => {
    lastUv = null;
    turning = null;
    spin = AUTO_SPIN * 0.5;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / Math.max(1, clientHeight);
    camera.updateProjectionMatrix();
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  let frame = 0;
  const loop = () => {
    ball.rotation.y += spin;
    renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  };
  loop();

  return {
    setMaterial(next: Material) {
      material = next;
      ball.geometry.dispose();
      ball.geometry = makeGeometry(next);
      (ball.material as THREE.Material).dispose();
      ball.material = makeMaterial(next, texture);
      compose();
    },
    setPen(color: string) {
      pen = color;
      isErasing = false;
    },
    setEraser() {
      isErasing = true;
    },
    setBrush(size: number) {
      brush = size;
    },
    clear() {
      strokeContext?.clearRect(0, 0, PAINT_W, PAINT_H);
      compose();
    },
    /** A small, round, lit picture of the ball as it is now, for the game. */
    snapshot(): string {
      const saved = ball.rotation.clone();
      renderer.render(scene, camera);
      const out = document.createElement('canvas');
      out.width = BALL_ART.size;
      out.height = BALL_ART.size;
      const g = out.getContext('2d');
      if (!g) return '';
      // The ball fills the middle of the view; crop to it.
      const size = Math.min(canvas.width, canvas.height) * 0.56;
      const sx = (canvas.width - size) / 2;
      const sy = (canvas.height - size) / 2;
      g.beginPath();
      g.arc(BALL_ART.size / 2, BALL_ART.size / 2, BALL_ART.size / 2, 0, Math.PI * 2);
      g.clip();
      g.drawImage(canvas, sx, sy, size, size, 0, 0, BALL_ART.size, BALL_ART.size);
      ball.rotation.copy(saved);
      return out.toDataURL('image/png');
    },
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      ball.geometry.dispose();
      (ball.material as THREE.Material).dispose();
      texture.dispose();
      pmrem.dispose();
      renderer.dispose();
    },
  };
}
