import { useCallback, useEffect, useState } from 'react';
import type { ErrorResponse, InitResponse, VoteRequest, VoteResponse } from '../shared/api';

type HunchState =
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

async function fetchRound(): Promise<HunchState> {
  try {
    const data = await readJson<InitResponse>(await fetch('/api/init'));
    return { status: 'ready', data };
  } catch (error) {
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load the round.' };
  }
}

/** Loads the round for this post and sends the player's vote. */
export function useHunch() {
  const [state, setState] = useState<HunchState>({ status: 'loading' });
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    void fetchRound().then((next) => {
      if (isActive) setState(next);
    });
    return () => {
      isActive = false;
    };
  }, []);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    setState(await fetchRound());
  }, []);

  const vote = useCallback(async (request: VoteRequest) => {
    setVoting(true);
    setVoteError(null);
    try {
      const result = await readJson<VoteResponse>(
        await fetch('/api/vote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
      );
      setState((previous) =>
        previous.status === 'ready'
          ? { status: 'ready', data: { ...previous.data, day: result.day, me: result.me } }
          : previous
      );
    } catch (error) {
      setVoteError(error instanceof Error ? error.message : 'Could not save your answer.');
    } finally {
      setVoting(false);
    }
  }, []);

  return { state, reload: load, vote, voting, voteError } as const;
}
