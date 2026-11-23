import { useCallback, useEffect, useState } from 'react';
import type { ErrorResponse, InitResponse, ShotRequest, ShotResponse } from '../../shared/api';

type RoundState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: InitResponse };

function isError(value: unknown): value is ErrorResponse {
  return typeof value === 'object' && value !== null && 'status' in value && value.status === 'error';
}

async function readJson<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok || isError(body)) {
    throw new Error(isError(body) ? body.message : `Request failed (${response.status})`);
  }
  return body as T;
}

async function fetchRound(): Promise<RoundState> {
  try {
    return { status: 'ready', data: await readJson<InitResponse>(await fetch('/api/init')) };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load today’s level.' };
  }
}

/** Loads this post's round and reports shots to the server. */
export function useRound() {
  const [state, setState] = useState<RoundState>({ status: 'loading' });
  const [shotError, setShotError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    void fetchRound().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const reload = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchRound());
  }, []);

  const reportShot = useCallback(async (shot: ShotRequest) => {
    try {
      const result = await readJson<ShotResponse>(
        await fetch('/api/shot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(shot),
        })
      );
      setShotError(null);
      setState((previous) =>
        previous.status === 'ready'
          ? {
              status: 'ready',
              data: { ...previous.data, mine: result.mine, me: result.me, leaders: result.leaders, ghosts: result.ghosts },
            }
          : previous
      );
      return result;
    } catch (error) {
      setShotError(error instanceof Error ? error.message : 'Could not save that shot.');
      return undefined;
    }
  }, []);

  return { state, reload, reportShot, shotError } as const;
}
