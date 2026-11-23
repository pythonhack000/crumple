import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { requestExpandedMode } from '@devvit/web/client';

export function Splash() {
  return (
    <main className="flex min-h-screen flex-col justify-between gap-5 bg-felt p-5 text-ink">
      <p className="text-ink-soft">A new trick shot every day. Everyone gets the same level.</p>
      <h1 className="font-display text-[2.6rem] font-bold leading-[1.02]">One Shot</h1>
      <button
        type="button"
        className="h-12 rounded-full bg-coral font-semibold text-ink"
        onClick={(event) => requestExpandedMode(event.nativeEvent, 'game')}
      >
        Take today’s shot
      </button>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Splash />
  </StrictMode>
);
