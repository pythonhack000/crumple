import { Hono } from 'hono';
import { reddit } from '@devvit/web/server';
import type { ErrorResponse, LevelsResponse, SubmitLevelResponse, VoteResponse } from '../../shared/api';
import { dayKeyOf } from '../../shared/game';
import { parseLevel } from '../../shared/level';
import { findSolution } from '../../shared/sim';
import * as store from '../core/store';

const LIST_SIZE = 20;
const MAX_SUBMISSIONS_PER_DAY = 3;

export const levels = new Hono();

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

levels.get('/', async (c) => {
  try {
    const username = await reddit.getCurrentUsername();
    const list = await store.listCommunityLevels(LIST_SIZE);
    const voted = await Promise.all(list.map((item) => (username ? store.hasVoted(item.id, username) : false)));
    return c.json<LevelsResponse>({
      type: 'levels',
      levels: list.map((item, index) => ({ ...item, voted: voted[index] ?? false })),
    });
  } catch (error) {
    console.error('Listing community levels failed', error);
    return c.json(fail('Could not load the levels. Try again.'), 500);
  }
});

levels.post('/', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to Reddit to share a level.'), 401);

  const body: unknown = await c.req.json().catch(() => undefined);
  const level = parseLevel(body);
  if (!level) return c.json(fail('That level could not be read. Check its name and pieces.'), 400);

  try {
    const today = dayKeyOf(new Date());
    if ((await store.countSubmissionsToday(today, username)) >= MAX_SUBMISSIONS_PER_DAY) {
      return c.json(fail(`You can share ${MAX_SUBMISSIONS_PER_DAY} levels a day. Come back tomorrow.`), 429);
    }
    // The server proves the level can be beaten; the author's word is not enough.
    if (!findSolution(level)) {
      return c.json(fail('Nobody could get the ball in the bin on this one. Make it possible, then share it.'), 422);
    }
    const id = await store.addCommunityLevel(today, username, { ...level, author: username });
    return c.json<SubmitLevelResponse>({ type: 'submitted', id });
  } catch (error) {
    console.error(`Sharing a level failed for ${username}`, error);
    return c.json(fail('Could not share your level. Try again.'), 500);
  }
});

levels.post('/:id/vote', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to Reddit to vote.'), 401);
  const id = c.req.param('id');
  if (!/^\d{1,9}$/.test(id)) return c.json(fail('Unknown level.'), 404);

  try {
    const author = await store.levelAuthor(id);
    if (!author) return c.json(fail('That level is gone.'), 404);
    if (author === username) return c.json(fail('You can’t upvote your own level.'), 409);
    const votes = await store.voteForLevel(id, username);
    if (votes === undefined) return c.json(fail('You already upvoted this one.'), 409);
    return c.json<VoteResponse>({ type: 'vote', votes });
  } catch (error) {
    console.error(`Vote failed for ${username} on level ${id}`, error);
    return c.json(fail('Could not count your vote. Try again.'), 500);
  }
});
