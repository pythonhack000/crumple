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

menu.post('/queue-question', async (c) => {
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'queueQuestion',
        form: {
          title: 'Queue a Hunch question',
          description: 'Queued questions run before the built-in ones, oldest first.',
          fields: [
            { name: 'prompt', label: 'Question', type: 'string', required: true },
            { name: 'option1', label: 'Option 1', type: 'string', required: true },
            { name: 'option2', label: 'Option 2', type: 'string', required: true },
            { name: 'option3', label: 'Option 3 (optional)', type: 'string' },
            { name: 'option4', label: 'Option 4 (optional)', type: 'string' },
          ],
          acceptLabel: 'Queue it',
        },
      },
    },
    200
  );
});
