// All sound is synthesised with Web Audio: no audio files, no licensing.
// Music: a lo-fi loop on a soft electric piano with vinyl crackle.
// Effects: depend on what the ball is made of (paper, rubber, tin, glass).
// Browsers only allow sound after a user gesture, so `unlock()` is called
// from the first pointer press.
import type { Material } from '../../shared/ball-art';
import { getPrefs, onPrefsChange } from './prefs';

const MUSIC_GAIN = 0.2;
const SFX_GAIN = 0.75;
const BPM = 76;
const SWING = 0.18;
const LOOKAHEAD_S = 0.6;
const FILTER_CLOSED = 1200;
const FILTER_OPEN = 7000;

type Chord = { root: number; voicing: number[] };
// Fmaj9, Em7, Dm9, Cmaj7(add9): warm and a little wistful.
const PROGRESSION: Chord[] = [
  { root: 41, voicing: [57, 60, 64, 67] },
  { root: 40, voicing: [55, 59, 62, 67] },
  { root: 38, voicing: [57, 60, 64, 65] },
  { root: 36, voicing: [55, 59, 62, 64] },
];

let ctx: AudioContext | null = null;
let musicOut: GainNode | null = null;
let sfxOut: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noise: AudioBuffer | null = null;
let musicTimer: number | null = null;
let nextStep = 0;
let step = 0;
let material: Material = 'paper';
let stretchStep = -1;

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
const sixteenth = () => 60 / BPM / 4;

function applyPrefs() {
  if (!ctx || !musicOut || !sfxOut) return;
  const prefs = getPrefs();
  musicOut.gain.setTargetAtTime(prefs.music ? MUSIC_GAIN : 0, ctx.currentTime, 0.1);
  sfxOut.gain.setTargetAtTime(prefs.sounds ? SFX_GAIN : 0, ctx.currentTime, 0.05);
}
onPrefsChange(applyPrefs);

function setup(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch (error) {
    console.error('Web Audio is not available', error);
    return null;
  }
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = FILTER_OPEN * 0.6;
  musicFilter.Q.value = 0.4;
  musicOut = ctx.createGain();
  musicOut.gain.value = 0;
  musicOut.connect(musicFilter).connect(ctx.destination);
  sfxOut = ctx.createGain();
  sfxOut.gain.value = 0;
  sfxOut.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  applyPrefs();
  return ctx;
}

/** Call from a user gesture. Starts the music loop the first time. */
export function unlock() {
  const audio = setup();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();
  if (musicTimer === null) {
    nextStep = audio.currentTime + 0.1;
    musicTimer = window.setInterval(scheduleMusic, 200);
  }
}

export function setMaterial(value: Material) {
  material = value;
}

// Building blocks

function env(start: number, attack: number, decay: number, peak: number): GainNode | null {
  if (!ctx) return null;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay);
  return gain;
}

function osc(freq: number, start: number, length: number, type: OscillatorType, peak: number, out: AudioNode, endFreq?: number, attack = 0.005) {
  if (!ctx) return;
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.setValueAtTime(freq, start);
  if (endFreq) node.frequency.exponentialRampToValueAtTime(endFreq, start + length);
  const gain = env(start, attack, length, peak);
  if (!gain) return;
  node.connect(gain).connect(out);
  node.start(start);
  node.stop(start + attack + length + 0.05);
}

function burst(start: number, length: number, peak: number, freq: number, out: AudioNode, type: BiquadFilterType = 'bandpass', q = 1) {
  if (!ctx || !noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = env(start, 0.002, length, peak);
  if (!gain) return;
  source.connect(filter).connect(gain).connect(out);
  source.start(start, Math.random() * 1.5, length + 0.05);
}

/** Filtered noise whose pitch sweeps from `fromHz` to `toHz`: a whoosh. */
function sweep(start: number, length: number, peak: number, fromHz: number, toHz: number, out: AudioNode) {
  if (!ctx || !noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 1.4;
  filter.frequency.setValueAtTime(fromHz, start);
  filter.frequency.exponentialRampToValueAtTime(toHz, start + length);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + length * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  source.connect(filter).connect(gain).connect(out);
  source.start(start, Math.random() * 1.5, length + 0.05);
}

/** A soft electric piano: a sine carrier lightly frequency-modulated, bell-like at the start. */
function ePiano(note: number, start: number, length: number, peak: number, out: AudioNode) {
  if (!ctx) return;
  const freq = midiToHz(note);
  const carrier = ctx.createOscillator();
  const modulator = ctx.createOscillator();
  const depth = ctx.createGain();
  carrier.frequency.value = freq;
  modulator.frequency.value = freq * 2;
  depth.gain.setValueAtTime(freq * 1.4, start);
  depth.gain.exponentialRampToValueAtTime(freq * 0.05, start + 0.6);
  modulator.connect(depth).connect(carrier.frequency);
  const gain = env(start, 0.008, length, peak);
  if (!gain) return;
  carrier.connect(gain).connect(out);
  carrier.start(start);
  modulator.start(start);
  carrier.stop(start + length + 0.1);
  modulator.stop(start + length + 0.1);
}

// Music

const chordAt = (s: number): Chord => PROGRESSION[Math.floor(s / 16) % PROGRESSION.length] ?? PROGRESSION[0]!;

function scheduleMusic() {
  if (!ctx || !musicOut) return;
  while (nextStep < ctx.currentTime + LOOKAHEAD_S) {
    const inBar = step % 16;
    const swing = inBar % 2 === 1 ? sixteenth() * SWING : 0;
    const t = nextStep + swing;
    const chord = chordAt(step);
    const out = musicOut;
    if (inBar === 0 || inBar === 10) {
      chord.voicing.forEach((note, i) => ePiano(note, t + i * 0.012, sixteenth() * (inBar === 0 ? 9 : 5), 0.11, out));
    }
    if (inBar === 0) osc(midiToHz(chord.root), t, sixteenth() * 7, 'sine', 0.5, out, undefined, 0.02);
    if (inBar === 7) osc(midiToHz(chord.root + 7), t, sixteenth() * 3, 'sine', 0.35, out, undefined, 0.02);
    // Drums: a muffled kick, a brushed snare, soft closed hats.
    if (inBar === 0 || inBar === 9) osc(110, t, 0.18, 'sine', 0.8, out, 42);
    if (inBar === 4 || inBar === 12) burst(t, 0.18, 0.35, 1800, out, 'bandpass', 0.5);
    if (inBar % 2 === 0) burst(t, 0.03, inBar % 4 === 2 ? 0.14 : 0.07, 8000, out, 'highpass');
    // A few melody notes, never the same bar twice.
    if ((inBar === 6 || inBar === 14) && Math.random() < 0.5) {
      const voicing = chord.voicing;
      ePiano((voicing[Math.floor(Math.random() * voicing.length)] ?? 64) + 12, t, sixteenth() * 4, 0.06, out);
    }
    // Vinyl crackle.
    for (let i = 0; i < 2; i += 1) if (Math.random() < 0.6) burst(t + Math.random() * sixteenth(), 0.004, 0.08, 3000, out, 'highpass');
    nextStep += sixteenth();
    step += 1;
  }
}

/** While aiming, the music opens up with the power of the pull. */
export function setAimPower(power: number) {
  if (!ctx || !musicFilter) return;
  const target = FILTER_CLOSED + (FILTER_OPEN - FILTER_CLOSED) * Math.min(1, Math.max(0, power));
  musicFilter.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
}

/** Muffles the music, like holding your breath, for the slow-motion moment. */
export function setHoldBreath(isHeld: boolean) {
  if (!ctx || !musicFilter) return;
  musicFilter.frequency.setTargetAtTime(isHeld ? 450 : FILTER_OPEN * 0.6, ctx.currentTime, isHeld ? 0.05 : 0.3);
}

// Effects, by material

function sfxNow(): { t: number; out: GainNode } | null {
  if (!ctx || !sfxOut) return null;
  return { t: ctx.currentTime, out: sfxOut };
}

/** A crinkle: a cluster of tiny paper crackles. */
function crinkle(t: number, out: AudioNode, amount: number) {
  for (let i = 0; i < 4 + Math.round(amount * 6); i += 1) {
    burst(t + Math.random() * 0.06 * (0.5 + amount), 0.012 + Math.random() * 0.02, 0.12 + 0.35 * amount, 2500 + Math.random() * 4500, out, 'bandpass', 2);
  }
}

/** Metal: inharmonic partials that ring and fade. */
function clank(t: number, out: AudioNode, base: number, peak: number, length: number) {
  [1, 2.76, 5.4, 8.93].forEach((ratio, i) => osc(base * ratio, t, length / (i + 1), 'sine', peak / (i + 1.3), out));
  burst(t, 0.02, peak * 0.6, 5000, out, 'highpass');
}

function impact(speed: number) {
  const now = sfxNow();
  if (!now) return;
  const { t, out } = now;
  const amount = Math.min(1, speed / 12);
  switch (material) {
    case 'paper':
      burst(t, 0.07, 0.25 + 0.4 * amount, 220, out, 'lowpass', 0.7);
      crinkle(t, out, amount);
      break;
    case 'rubber':
      osc(180 + amount * 120, t, 0.18, 'sine', 0.25 + 0.35 * amount, out, 90);
      osc(420, t, 0.05, 'triangle', 0.08 * amount, out, 300);
      break;
    case 'tin':
      clank(t, out, 520 + Math.random() * 120, 0.12 + 0.3 * amount, 0.35 + 0.4 * amount);
      break;
    case 'glass':
      osc(3200 + Math.random() * 900, t, 0.08 + 0.15 * amount, 'sine', 0.1 + 0.3 * amount, out);
      osc(5100, t, 0.04, 'sine', 0.05 + 0.1 * amount, out);
      break;
  }
}

export const sfx = {
  /** Slingshot release: the band snaps, a low thump, then a rising whoosh. */
  launch(power = 0.6) {
    const now = sfxNow();
    if (!now) return;
    const { t, out } = now;
    burst(t, 0.006, 0.5, 4000, out, 'highpass');
    osc(150, t, 0.09, 'sine', 0.45, out, 55);
    osc(420 + power * 260, t, 0.07, 'triangle', 0.12, out, 180);
    sweep(t + 0.01, 0.18 + power * 0.14, 0.18 + power * 0.32, 280, 2600 + power * 2400, out);
    if (material === 'paper') crinkle(t + 0.02, out, 0.25);
    stretchStep = -1;
    setAimPower(0.6);
  },
  /** Faint creaks of the band while pulling back, rising with the power. */
  stretch(power: number) {
    const bucket = Math.floor(power * 10);
    if (bucket === stretchStep || bucket === 0) return;
    stretchStep = bucket;
    const now = sfxNow();
    if (!now) return;
    osc(500 + bucket * 90, now.t, 0.025, 'triangle', 0.035 + bucket * 0.004, now.out);
  },
  hit(speed: number) {
    impact(speed);
  },
  bump() {
    const now = sfxNow();
    if (!now) return;
    osc(520, now.t, 0.2, 'sine', 0.3, now.out, 190);
    impact(8);
  },
  star() {
    const now = sfxNow();
    if (!now) return;
    chordAt(step).voicing.forEach((note, i) => ePiano(note + 12, now.t + i * 0.05, 0.6, 0.12, now.out));
  },
  portal() {
    const now = sfxNow();
    if (!now) return;
    burst(now.t, 0.35, 0.35, 500, now.out, 'lowpass', 0.8);
    osc(240, now.t, 0.3, 'sine', 0.1, now.out, 800);
  },
  cup() {
    const now = sfxNow();
    if (!now) return;
    const { t, out } = now;
    // The landing, then a little chord in key.
    if (material === 'paper') {
      burst(t, 0.2, 0.6, 180, out, 'lowpass', 0.6);
      crinkle(t + 0.02, out, 0.6);
    } else if (material === 'tin') {
      clank(t, out, 330, 0.5, 1.2);
    } else if (material === 'glass') {
      [0, 0.09, 0.16, 0.21].forEach((d, i) => osc(3600 - i * 300, t + d, 0.12, 'sine', 0.25 / (i + 1), out));
    } else {
      osc(160, t, 0.35, 'sine', 0.6, out, 70);
    }
    const chord = chordAt(step);
    chord.voicing.forEach((note, i) => ePiano(note + 12, t + 0.18 + i * 0.08, 1.2, 0.13, out));
  },
  /** Glass day: the ball shatters into a cascade of high tinkles. */
  shatter() {
    const now = sfxNow();
    if (!now) return;
    burst(now.t, 0.08, 0.5, 6000, now.out, 'highpass');
    for (let i = 0; i < 9; i += 1) {
      osc(2600 + Math.random() * 3200, now.t + i * 0.03 + Math.random() * 0.02, 0.09, 'sine', 0.12, now.out);
    }
  },
  miss() {
    const now = sfxNow();
    if (!now) return;
    osc(300, now.t, 0.5, 'triangle', 0.1, now.out, 150);
    setAimPower(0.6);
  },
};
