import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import type { TriggerResponse } from '@devvit/web/shared';
import { startDay } from '../core/rounds';

export const triggers = new Hono();

/** Opens the first round as soon as a subreddit installs the game. */
triggers.post('/on-app-install', async (c) => {
  try {
    const round = await startDay(new Date());
    return c.json<TriggerResponse>({ status: 'success', message: `Round ${round.dayKey} is open` }, 200);
  } catch (error) {
    console.error('Could not open the first round', error);
    return c.json<TriggerResponse>({ status: 'error', message: 'Could not open the first round' }, 400);
  }
});

export const scheduler = new Hono();

/** Runs at 00:00 UTC: closes yesterday's round and opens today's. */
scheduler.post('/new-day', async (c) => {
  try {
    const round = await startDay(new Date());
    console.log(`Round ${round.dayKey} is open in post ${round.postId}`);
    return c.json<TaskResponse>({ status: 'ok' }, 200);
  } catch (error) {
    console.error('Daily round rollover failed', error);
    return c.json<TaskResponse>({ status: 'error' }, 500);
  }
});
