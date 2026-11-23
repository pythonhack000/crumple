import { Hono } from 'hono';
import { context, reddit } from '@devvit/web/server';
import type { BallArtResponse, ErrorResponse, InitResponse, PileBall, ShotResponse } from '../../shared/api';
import { parseBallArt, parseMaterial } from '../../shared/ball-art';
import { parseShot } from '../../shared/shot';
import { buildRoundView, getStats, recordShot, ShotError } from '../core/rounds';
import * as store from '../core/store';
import type { Round } from '../core/store';

const LEADERBOARD_SIZE = 5;

export const api = new Hono();

/** Drawn balls for the viewer and for whoever owns balls on the pile, newest first. */
function artsFor(pile: PileBall[], username: string | undefined) {
  const owners = pile.map((ball) => ball.owner).reverse();
  return store.getBallArts(username ? [username, ...owners] : owners);
}

const fail = (message: string): ErrorResponse => ({ status: 'error', message });

async function todaysPostId(viewedPostId: string): Promise<string | null> {
  const currentKey = await store.getCurrentDayKey();
  const current = currentKey ? await store.getRound(currentKey) : undefined;
  return current && current.postId !== viewedPostId ? current.postId : null;
}

/** Ghosts are a reward: shown once you sank it, or once the round is over. */
async function ghostsFor(round: Round, username: string | undefined, hasSunk: boolean) {
  return hasSunk || round.status === 'closed' ? store.getGhosts(round.dayKey, username) : [];
}

api.get('/init', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This game only runs inside a post.'), 400);

  try {
    const round = await store.getRoundForPost(postId);
    if (!round) return c.json(fail('This post is not a Crumple round.'), 404);

    const username = (await reddit.getCurrentUsername()) ?? undefined;
    const mine = username ? await store.getMyRound(round.dayKey, username) : null;
    const [view, me, leaders, ghosts, pile, todayPostId] = await Promise.all([
      buildRoundView(round),
      username ? getStats(username) : Promise.resolve(null),
      store.getDayLeaders(round.dayKey, LEADERBOARD_SIZE),
      ghostsFor(round, username, mine?.sunk != null),
      store.getPile(round.dayKey, username),
      todaysPostId(postId),
    ]);
    const [arts, material] = await Promise.all([artsFor(pile, username), store.getBallMaterial(username)]);
    return c.json<InitResponse>({ type: 'init', round: view, me, mine, leaders, ghosts, pile, arts, material, todayPostId });
  } catch (error) {
    console.error(`Init failed for post ${postId}`, error);
    return c.json(fail('Could not load today’s level. Try again in a moment.'), 500);
  }
});

api.post('/shot', async (c) => {
  const { postId } = context;
  if (!postId) return c.json(fail('This game only runs inside a post.'), 400);

  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to Reddit to get on the board.'), 401);

  try {
    const round = await store.getRoundForPost(postId);
    if (!round) return c.json(fail('This post is not a Crumple round.'), 404);
    const shot = parseShot(await c.req.json().catch(() => undefined), round.level.stars.length);
    if (!shot) return c.json(fail('That shot could not be read.'), 400);

    const { mine, counted } = await recordShot(round, username, shot);
    const [me, leaders, ghosts, pile] = await Promise.all([
      getStats(username),
      store.getDayLeaders(round.dayKey, LEADERBOARD_SIZE),
      ghostsFor(round, username, mine.sunk !== null),
      store.getPile(round.dayKey, username),
    ]);
    const arts = await artsFor(pile, username);
    return c.json<ShotResponse>({ type: 'shot', mine, me, leaders, ghosts, pile, arts, counted });
  } catch (error) {
    if (error instanceof ShotError) return c.json(fail(error.message), 409);
    console.error(`Shot failed for ${username} on post ${postId}`, error);
    return c.json(fail('Could not save that shot. Your next one will count.'), 500);
  }
});

/** Saves (or clears, with art: null) the viewer's drawn ball. */
api.post('/ball', async (c) => {
  const username = await reddit.getCurrentUsername();
  if (!username) return c.json(fail('Log in to Reddit to draw your ball.'), 401);
  const body: unknown = await c.req.json().catch(() => undefined);
  const fields = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const art = fields.art === null ? null : parseBallArt(fields.art);
  if (art === undefined) return c.json(fail('That drawing could not be saved. Try a simpler one.'), 400);
  const material = parseMaterial(fields.material);
  try {
    await Promise.all([store.setBallArt(username, art), store.setBallMaterial(username, material)]);
    return c.json<BallArtResponse>({ type: 'ball', art, material });
  } catch (error) {
    console.error(`Saving ball art failed for ${username}`, error);
    return c.json(fail('Could not save your ball. Try again.'), 500);
  }
});
