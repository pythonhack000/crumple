import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { startDay } from '../core/rounds';

export const menu = new Hono();

const postUrl = (postId: string) => `https://reddit.com/r/${context.subredditName}/comments/${postId}`;

/** Opens today's round now (or jumps to it if it is already up). */
menu.post('/start-today', async (c) => {
  try {
    const round = await startDay(new Date());
    return c.json<UiResponse>({ navigateTo: postUrl(round.postId) }, 200);
  } catch (error) {
    console.error('Could not start today’s round', error);
    return c.json<UiResponse>({ showToast: 'Could not start today’s round' }, 400);
  }
});
