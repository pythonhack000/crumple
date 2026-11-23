import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { queueQuestion } from '../core/store';

const MAX_PROMPT_LENGTH = 120;
const MAX_OPTION_LENGTH = 40;

export const forms = new Hono();

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

forms.post('/queue-question', async (c) => {
  const body: Record<string, unknown> = await c.req.json<Record<string, unknown>>().catch(() => ({}));
  const prompt = text(body.prompt);
  const options = ['option1', 'option2', 'option3', 'option4'].map((name) => text(body[name])).filter(Boolean);

  if (!prompt || prompt.length > MAX_PROMPT_LENGTH) {
    return c.json<UiResponse>({ showToast: `The question needs 1 to ${MAX_PROMPT_LENGTH} characters.` }, 200);
  }
  if (options.length < 2) {
    return c.json<UiResponse>({ showToast: 'Give at least two options.' }, 200);
  }
  if (options.some((option) => option.length > MAX_OPTION_LENGTH)) {
    return c.json<UiResponse>({ showToast: `Keep each option under ${MAX_OPTION_LENGTH} characters.` }, 200);
  }
  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    return c.json<UiResponse>({ showToast: 'Options must be different.' }, 200);
  }

  try {
    const waiting = await queueQuestion({ prompt, options });
    return c.json<UiResponse>({ showToast: `Queued. ${waiting} question${waiting === 1 ? '' : 's'} waiting.` }, 200);
  } catch (error) {
    console.error('Could not queue question', error);
    return c.json<UiResponse>({ showToast: 'Could not queue the question. Try again.' }, 200);
  }
});
