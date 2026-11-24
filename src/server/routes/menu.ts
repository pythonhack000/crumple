import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { postGuide } from '../core/guide';
import { repostToday, startDay } from '../core/rounds';

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

/** Posts today's level again, e.g. after the app's look or name changed. */
menu.post('/repost-today', async (c) => {
  try {
    const round = await repostToday();
    if (!round) return c.json<UiResponse>({ showToast: 'No level is open today yet' }, 200);
    return c.json<UiResponse>({ navigateTo: postUrl(round.postId) }, 200);
  } catch (error) {
    console.error('Could not repost today’s level', error);
    return c.json<UiResponse>({ showToast: 'Could not repost today’s level' }, 400);
  }
});

/** Posts the how-to-play guide and pins it. */
menu.post('/post-guide', async (c) => {
  try {
    const postId = await postGuide();
    return c.json<UiResponse>({ navigateTo: postUrl(postId) }, 200);
  } catch (error) {
    console.error('Could not post the guide', error);
    return c.json<UiResponse>({ showToast: 'Could not post the guide' }, 400);
  }
});
