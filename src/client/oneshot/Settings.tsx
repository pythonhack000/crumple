import { useEffect, useState } from 'react';
import { getPrefs, onPrefsChange, setPref } from './prefs';
import type { Prefs } from './prefs';
import { SketchButton } from './Sketchy';

const OPTIONS: { key: keyof Prefs; label: string; detail: string }[] = [
  { key: 'music', label: 'Music', detail: 'The lo-fi loop in the background.' },
  { key: 'sounds', label: 'Sounds', detail: 'Bounces, the bin, stars.' },
  { key: 'slowMotion', label: 'Slow motion at the bin', detail: 'Time slows and the camera leans in.' },
  { key: 'replay', label: 'Replay after a sink', detail: 'Watch your throw again, slowly.' },
];

/** A hand-drawn tick box. */
function Tick({ isOn }: { isOn: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 28" className="h-7 w-7 shrink-0">
      <path d="M4 5 C 11 3, 18 4, 24 4 C 25 11, 24 18, 24 24 C 17 25, 10 24, 4 24 C 3 17, 4 11, 4 5 Z" fill="none" strokeWidth="2" className="stroke-ink" strokeLinecap="round" />
      {isOn && <path d="M7 14 L12 20 L22 7" fill="none" strokeWidth="3" className="stroke-coral" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

export function Settings({ onClose }: { onClose: () => void }) {
  const [prefs, setPrefs] = useState<Prefs>(getPrefs());
  useEffect(() => onPrefsChange(setPrefs), []);

  return (
    <div className="absolute inset-0 z-20 flex flex-col gap-4 bg-felt p-5 text-ink" role="dialog" aria-label="Settings">
      <h2 className="-rotate-1 font-display text-3xl">Settings</h2>
      <ul className="flex flex-col gap-3">
        {OPTIONS.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[option.key]}
              onClick={() => setPref(option.key, !prefs[option.key])}
              className="flex w-full items-start gap-3 text-left"
            >
              <Tick isOn={prefs[option.key]} />
              <span>
                <span className="block font-display text-xl leading-tight">{option.label}</span>
                <span className="block text-sm text-ink-soft">{option.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-sm text-ink-soft">Saved in this browser.</p>
      <SketchButton className="self-start" onClick={onClose}>
        Done
      </SketchButton>
    </div>
  );
}
