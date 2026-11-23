import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { ErrorResponse, InitResponse, VoteRequest, VoteResponse } from '../../shared/api';
import { buildDayView, castVote, getStats, VoteError } from '../core/rounds';
import { getCurrentDayKey, getLeaders, getRound, getRoundForPost } from '../core/store';

const LEADERBOARD_SIZE = 5;

export const api = new Hono();

async function todaysPostId(viewedPostId: string): Promise<string | null> {
  const currentKey = await getCurrentDayKey();
  const current = currentKey ? await getRound(currentKey) : undefined;
  return current && current.postId !== viewedPostId ? current.postId : null;
}

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This game only runs inside a post.'), 400);

  try {
    const round = await getRoundForPost(postId);
    if (!round) return c.json(fail('This post is not a Hunch round.'), 404);

    const username = (await reddit.getCurrentUsername()) ?? undefined;
    const [day, me, leaders, todayPostId] = await Promise.all([
      buildDayView(round, username),
      username ? getStats(username) : Promise.resolve(null),
      getLeaders(LEADERBOARD_SIZE),
      todaysPostId(postId),
    ]);
    return c.json<InitResponse>({ type: 'init', day, me, leaders, todayPostId });
  } catch (error) {
    console.error(`Init failed for post ${postId}`, error);
    return c.json(fail('Could not load today’s round. Try again in a moment.'), 500);
  }
});

function parseVoteRequest(body: unknown): VoteRequest | undefined {
  if (typeof body !== 'object' || body === null) return undefined;
  if (!('pick' in body) || !('call' in body)) return undefined;
  const { pick, call } = body;
  return typeof pick === 'number' && typeof call === 'number' ? { pick, call } : undefined;
}

api.post('/vote', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This game only runs inside a post.'), 400);

  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to Reddit to play.'), 401);

  const request = parseVoteRequest(await c.req.json().catch(() => undefined));
  if (!request) return c.json(fail('Pick an answer and a call first.'), 400);

  try {
    const round = await getRoundForPost(postId);
    if (!round) return c.json(fail('This post is not a Hunch round.'), 404);
    await castVote(round, username, request);
    const [day, me] = await Promise.all([buildDayView(round, username), getStats(username)]);
    return c.json<VoteResponse>({ type: 'vote', day, me });
  } catch (error) {
    if (error instanceof VoteError) return c.json(fail(error.message), 409);
    console.error(`Vote failed for ${username} on post ${postId}`, error);
    return c.json(fail('Could not save your answer. Try again.'), 500);
  }
});
