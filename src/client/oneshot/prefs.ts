// Per-viewer preferences, kept in this browser only. Storage can be blocked
// (private windows, embedded frames), so every access is guarded and the
// defaults always work.

export type Prefs = {
  music: boolean;
  sounds: boolean;
  slowMotion: boolean;
  replay: boolean;
};

const KEY = 'crumple-prefs';
const DEFAULTS: Prefs = { music: true, sounds: true, slowMotion: true, replay: true };

let current: Prefs = read();
const listeners = new Set<(prefs: Prefs) => void>();

function read(): Prefs {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) return DEFAULTS;
    const stored = value as Record<string, unknown>;
    return {
      music: typeof stored.music === 'boolean' ? stored.music : DEFAULTS.music,
      sounds: typeof stored.sounds === 'boolean' ? stored.sounds : DEFAULTS.sounds,
      slowMotion: typeof stored.slowMotion === 'boolean' ? stored.slowMotion : DEFAULTS.slowMotion,
      replay: typeof stored.replay === 'boolean' ? stored.replay : DEFAULTS.replay,
    };
  } catch {
    return DEFAULTS;
  }
}

export function getPrefs(): Prefs {
  return current;
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  current = { ...current, [key]: value };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Not saved, but it still applies for this visit.
  }
  for (const listener of listeners) listener(current);
}

export function onPrefsChange(listener: (prefs: Prefs) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
