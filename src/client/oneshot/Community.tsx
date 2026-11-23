import { useCallback, useEffect, useState } from 'react';
import type { CommunityLevel, ErrorResponse, LevelsResponse, VoteResponse } from '../../shared/api';
import { LevelSketch, SketchButton, SketchLink } from './Sketchy';
import { TryLevel } from './TryLevel';

type CommunityProps = {
  arts: Record<string, HTMLImageElement>;
  username: string | undefined;
  onBuild: () => void;
  onRemix: (level: CommunityLevel) => void;
  onClose: () => void;
};

async function readBody<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => undefined)) as T | ErrorResponse | undefined;
  if (!response.ok || !body || (typeof body === 'object' && 'status' in body && body.status === 'error')) {
    throw new Error(body && typeof body === 'object' && 'message' in body ? body.message : 'Something went wrong.');
  }
  return body as T;
}

/** Player-made levels; the most upvoted one becomes tomorrow's daily level. */
export function Community({ arts, username, onBuild, onRemix, onClose }: CommunityProps) {
  const [levels, setLevels] = useState<CommunityLevel[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trying, setTrying] = useState<CommunityLevel | null>(null);

  const load = useCallback(async () => {
    try {
      const body = await readBody<LevelsResponse>(await fetch('/api/levels'));
      setLevels(body.levels);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load the levels.');
    }
  }, []);

  useEffect(() => {
    let isActive = true;
    void (async () => {
      try {
        const body = await readBody<LevelsResponse>(await fetch('/api/levels'));
        if (isActive) setLevels(body.levels);
      } catch (caught) {
        if (isActive) setError(caught instanceof Error ? caught.message : 'Could not load the levels.');
      }
    })();
    return () => {
      isActive = false;
    };
  }, []);

  const upvote = async (item: CommunityLevel) => {
    try {
      const body = await readBody<VoteResponse>(await fetch(`/api/levels/${item.id}/vote`, { method: 'POST' }));
      setLevels((current) =>
        current?.map((entry) => (entry.id === item.id ? { ...entry, votes: body.votes, voted: true } : entry)) ?? current
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not count your vote.');
    }
  };

  return (
    <div className="absolute inset-0 z-10 flex flex-col gap-3 overflow-y-auto bg-felt p-4 text-ink" role="dialog" aria-label="Levels from the subreddit">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="-rotate-1 font-display text-3xl">Levels from the subreddit</h2>
        <SketchLink onClick={onClose}>Close</SketchLink>
      </div>
      <p className="text-sm text-ink-soft">The most upvoted level becomes tomorrow’s level for everyone, with its maker’s name on it.</p>
      <SketchButton tone="ink" className="self-start" onClick={onBuild}>
        Build your own
      </SketchButton>
      {error && (
        <p role="alert" className="text-sm text-coral">
          {error}{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      )}
      {levels === null && !error && <p className="text-ink-soft">Fetching levels…</p>}
      {levels?.length === 0 && <p className="text-ink-soft">No levels yet. Yours could be tomorrow’s.</p>}
      <ul className="flex flex-col">
        {levels?.map((item) => {
          const isMine = item.author === username;
          return (
            <li key={item.id} className="flex items-center gap-3 border-t border-dashed border-ink/25 py-3">
              <LevelSketch level={item.level} withPaper className="h-28 w-16 shrink-0 rounded-sm bg-felt shadow-[0_0_0_1px_rgba(34,64,143,0.15)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-xl">{item.level.name}</p>
                <p className="truncate text-sm text-ink-soft">
                  by u/{item.author}, {item.votes} {item.votes === 1 ? 'upvote' : 'upvotes'}
                </p>
                {item.level.basedOn && <p className="truncate text-xs text-ink-soft">remix of u/{item.level.basedOn}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                <SketchLink onClick={() => setTrying(item)}>Try it</SketchLink>
                {username && <SketchLink onClick={() => onRemix(item)} className="mt-2">Remix</SketchLink>}
                <SketchLink
                  disabled={item.voted || isMine || !username}
                  onClick={() => void upvote(item)}
                  className="mt-2 text-coral disabled:text-ink-soft disabled:opacity-60"
                >
                  {isMine ? 'Yours' : item.voted ? 'Upvoted' : 'Upvote'}
                </SketchLink>
              </div>
            </li>
          );
        })}
      </ul>
      {trying && (
        <TryLevel level={trying.level} title={trying.level.name} arts={arts} username={username} onClose={() => setTrying(null)} />
      )}
    </div>
  );
}
