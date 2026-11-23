// All sound is synthesised with Web Audio: no audio files, no licensing.
// Browsers only allow sound after a user gesture, so nothing plays until the
// first touch; `unlock()` is called from the first pointer press.

const MUTE_KEY = 'crumple-muted';
const MASTER_GAIN = 0.55;
const MUSIC_GAIN = 0.11;
const BPM = 78;

type Chord = number[];
// Fmaj7, Em7, Dm7, Cmaj7: soft, a little wistful, very office-at-4pm.
const PROGRESSION: Chord[] = [
  [53, 57, 60, 64],
  [52, 55, 59, 62],
  [50, 53, 57, 60],
  [48, 52, 55, 59],
];

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicBus: GainNode | null = null;
let noise: AudioBuffer | null = null;
let musicTimer: number | null = null;
let nextBar = 0;
let bar = 0;
let muted = readMuted();

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

const midiToHz = (note: number) => 440 * 2 ** ((note - 69) / 12);

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
  musicBus = ctx.createGain();
  musicBus.gain.value = MUSIC_GAIN;
  musicBus.connect(master);
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
    nextBar = audio.currentTime + 0.1;
    musicTimer = window.setInterval(scheduleMusic, 250);
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
  gain.gain.exponentialRampToValueAtTime(peak, start + Math.min(0.02, duration / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(bus);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function hiss(start: number, duration: number, peak: number, filterFreq: number, bus: AudioNode, type: BiquadFilterType = 'bandpass') {
  if (!ctx || !noise) return;
  const source = ctx.createBufferSource();
  source.buffer = noise;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = filterFreq;
  filter.Q.value = 0.9;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(peak, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(bus);
  source.start(start, Math.random() * 0.5, duration + 0.05);
}

function scheduleMusic() {
  if (!ctx || !musicBus) return;
  const barLength = (60 / BPM) * 4;
  while (nextBar < ctx.currentTime + 1) {
    const chord = PROGRESSION[bar % PROGRESSION.length] ?? [];
    for (const note of chord) tone(midiToHz(note), nextBar, barLength * 0.95, 'triangle', 0.18, musicBus);
    tone(midiToHz((chord[0] ?? 48) - 12), nextBar, barLength * 0.5, 'sine', 0.35, musicBus);
    for (let beat = 0; beat < 8; beat += 1) {
      hiss(nextBar + (beat * barLength) / 8, 0.05, beat % 2 === 0 ? 0.12 : 0.06, 8000, musicBus, 'highpass');
    }
    nextBar += barLength;
    bar += 1;
  }
}

function now(): number | null {
  if (!ctx || !master || muted) return null;
  return ctx.currentTime;
}

/** Sound effects, one per thing that can happen to the ball. */
export const sfx = {
  launch() {
    const t = now();
    if (t === null || !master) return;
    hiss(t, 0.18, 0.5, 2500, master);
    hiss(t + 0.05, 0.12, 0.3, 4200, master);
  },
  hit(speed: number) {
    const t = now();
    if (t === null || !master) return;
    const loudness = Math.min(1, speed / 12);
    tone(220 + speed * 10, t, 0.06, 'square', 0.08 * loudness + 0.02, master);
    hiss(t, 0.04, 0.25 * loudness, 1800, master);
  },
  bump() {
    const t = now();
    if (t === null || !master) return;
    tone(520, t, 0.22, 'sine', 0.35, master, 180);
  },
  star() {
    const t = now();
    if (t === null || !master) return;
    tone(1318, t, 0.25, 'sine', 0.22, master);
    tone(1976, t + 0.06, 0.3, 'sine', 0.16, master);
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
    [523, 659, 784].forEach((freq, i) => tone(freq, t + 0.18 + i * 0.08, 0.35, 'triangle', 0.18, master as GainNode));
  },
  miss() {
    const t = now();
    if (t === null || !master) return;
    tone(330, t, 0.45, 'triangle', 0.14, master, 165);
  },
};
