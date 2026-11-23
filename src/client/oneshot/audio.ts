// All sound is synthesised with Web Audio: no audio files, no licensing.
// The music is part of the game: every bounce plays a note from the chord
// that is sounding right now, so a throw writes its own little tune.
// Browsers only allow sound after a user gesture, so `unlock()` is called
// from the first pointer press.

const MUTE_KEY = 'crumple-muted';
const MASTER_GAIN = 0.6;
const MUSIC_GAIN = 0.16;
const BPM = 86;
const LOOKAHEAD_S = 0.6;
const FILTER_CLOSED = 900;
const FILTER_OPEN = 9000;

type Chord = { root: number; tones: number[] };
// Fmaj9, Em7, Dm9, Cmaj7: warm, a bit wistful, very office-at-4pm.
const PROGRESSION: Chord[] = [
  { root: 41, tones: [57, 60, 64, 67] },
  { root: 40, tones: [55, 59, 62, 67] },
  { root: 38, tones: [57, 60, 64, 65] },
  { root: 36, tones: [55, 59, 62, 64] },
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let musicFilter: BiquadFilterNode | null = null;
let noise: AudioBuffer | null = null;
let musicTimer: number | null = null;
let nextStep = 0;
let step = 0;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
const stepLength = () => 60 / BPM / 4;

function setup(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch (error) {
    console.error('Web Audio is not available', error);
    return null;
  }
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_GAIN;
  master.connect(ctx.destination);
  musicFilter = ctx.createBiquadFilter();
  musicFilter.type = 'lowpass';
  musicFilter.frequency.value = FILTER_OPEN * 0.5;
  musicFilter.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = MUSIC_GAIN;
  musicBus.connect(musicFilter);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
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

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_KEY, value ? '1' : '0');
  } catch {
    // Storage can be blocked; muting still works for this session.
  }
  if (ctx && master) master.gain.setTargetAtTime(value ? 0 : MASTER_GAIN, ctx.currentTime, 0.05);
}

function tone(freq: number, start: number, duration: number, type: OscillatorType, peak: number, bus: AudioNode, endFreq?: number) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.012, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function hiss(start: number, duration: number, peak: number, filterFreq: number, bus: AudioNode, type: BiquadFilterType = 'bandpass', q = 0.9) {
  if (!ctx || !noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(bus);
  source.start(start, Math.random() * 0.5, duration + 0.05);
}

/** A plucked note: quick attack, soft decay, a touch of octave shimmer. */
function pluck(note: number, start: number, peak: number, bus: AudioNode, length = 0.5) {
  tone(midiToHz(note), start, length, 'triangle', peak, bus);
  tone(midiToHz(note + 12), start, length * 0.5, 'sine', peak * 0.35, bus);
}

const currentChord = (): Chord => PROGRESSION[Math.floor(step / 16) % PROGRESSION.length] ?? PROGRESSION[0]!;

// Paper percussion: a palm on the desk, a crumpled sheet, a pencil tick.
function deskThump(t: number, bus: AudioNode) {
  tone(120, t, 0.22, 'sine', 0.9, bus, 45);
  hiss(t, 0.05, 0.25, 300, bus, 'lowpass');
}
function paperSnare(t: number, bus: AudioNode) {
  hiss(t, 0.16, 0.55, 2400, bus, 'bandpass', 0.6);
  hiss(t + 0.02, 0.08, 0.3, 5200, bus, 'bandpass', 1.2);
}
function pencilTick(t: number, bus: AudioNode, accent: boolean) {
  hiss(t, 0.025, accent ? 0.3 : 0.16, 7500, bus, 'highpass');
}

function scheduleMusic() {
  if (!ctx || !musicBus) return;
  while (nextStep < ctx.currentTime + LOOKAHEAD_S) {
    const t = nextStep;
    const inBar = step % 16;
    const chord = currentChord();
    if (inBar === 0) {
      for (const note of chord.tones) tone(midiToHz(note), t, stepLength() * 15, 'triangle', 0.09, musicBus);
      tone(midiToHz(chord.root), t, stepLength() * 7, 'sine', 0.5, musicBus);
    }
    if (inBar === 8) tone(midiToHz(chord.root + 7), t, stepLength() * 6, 'sine', 0.35, musicBus);
    if (inBar === 0 || inBar === 7 || inBar === 10) deskThump(t, musicBus);
    if (inBar === 4 || inBar === 12) paperSnare(t, musicBus);
    if (inBar % 2 === 0) pencilTick(t, musicBus, inBar % 4 === 2);
    // A sparse melody that wanders over the chord, so the loop never feels stuck.
    if ((inBar === 3 || inBar === 11 || inBar === 14) && Math.random() < 0.55) {
      const tones = chord.tones;
      pluck((tones[Math.floor(Math.random() * tones.length)] ?? 60) + 12, t, 0.07, musicBus, 0.6);
    }
    nextStep += stepLength();
    step += 1;
  }
}

function now(): number | null {
  if (!ctx || !master || muted) return null;
  return ctx.currentTime;
}

/** Picks a note of the current chord: higher on the page, higher in pitch. */
function noteForHeight(y: number, worldHeight: number): number {
  const tones = currentChord().tones;
  const ladder = [...tones, ...tones.map((n) => n + 12)];
  const t = 1 - Math.min(1, Math.max(0, y / worldHeight));
  return ladder[Math.min(ladder.length - 1, Math.floor(t * ladder.length))] ?? 60;
}

/** While aiming, the music opens up with the power of the pull. */
export function setAimPower(power: number) {
  if (!ctx || !musicFilter) return;
  const target = FILTER_CLOSED + (FILTER_OPEN - FILTER_CLOSED) * Math.min(1, Math.max(0, power));
  musicFilter.frequency.setTargetAtTime(target, ctx.currentTime, 0.08);
}

/** Muffles the music, like holding your breath, for the slow-motion moment. */
export function setHoldBreath(isHeld: boolean) {
  if (!ctx || !musicFilter || !musicBus) return;
  musicFilter.frequency.setTargetAtTime(isHeld ? 500 : FILTER_OPEN * 0.5, ctx.currentTime, isHeld ? 0.05 : 0.3);
  musicBus.gain.setTargetAtTime(isHeld ? MUSIC_GAIN * 0.5 : MUSIC_GAIN, ctx.currentTime, 0.1);
}

/** Sound effects; the musical ones follow the chord that is playing. */
export const sfx = {
  launch() {
    const t = now();
    if (t === null || !master) return;
    hiss(t, 0.18, 0.5, 2500, master);
    hiss(t + 0.05, 0.12, 0.3, 4200, master);
    setAimPower(0.5);
  },
  hit(speed: number, y: number, worldHeight: number) {
    const t = now();
    if (t === null || !master) return;
    const loudness = Math.min(1, speed / 12);
    pluck(noteForHeight(y, worldHeight), t, 0.08 + 0.18 * loudness, master, 0.45);
    hiss(t, 0.03, 0.15 * loudness, 1800, master);
  },
  bump(y: number, worldHeight: number) {
    const t = now();
    if (t === null || !master) return;
    const note = noteForHeight(y, worldHeight) + 12;
    pluck(note, t, 0.22, master, 0.5);
    tone(520, t, 0.18, 'sine', 0.18, master, 200);
  },
  star() {
    const t = now();
    if (t === null || !master) return;
    currentChord().tones.forEach((note, i) => pluck(note + 12, t + i * 0.045, 0.12, master as GainNode, 0.5));
  },
  portal() {
    const t = now();
    if (t === null || !master) return;
    hiss(t, 0.3, 0.35, 600, master, 'lowpass');
    tone(300, t, 0.25, 'sine', 0.12, master, 900);
  },
  cup() {
    const t = now();
    if (t === null || !master) return;
    tone(110, t, 0.3, 'sine', 0.6, master, 60);
    hiss(t, 0.12, 0.4, 900, master);
    const chord = currentChord();
    chord.tones.forEach((note, i) => pluck(note + 12, t + 0.12 + i * 0.07, 0.16, master as GainNode, 0.9));
    pluck(chord.root + 24, t + 0.45, 0.18, master, 1.2);
  },
  miss() {
    const t = now();
    if (t === null || !master) return;
    tone(330, t, 0.45, 'triangle', 0.12, master, 165);
    setAimPower(0.5);
  },
};
