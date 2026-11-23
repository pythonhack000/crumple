// Serves canned API responses so the UI can be previewed without Reddit.
// ?state=fresh (default) | sunk | guest
import { builtInLevelFor } from '../../src/shared/levels';

const state = new URLSearchParams(location.search).get('state') ?? 'fresh';
const levelNumber = Number(new URLSearchParams(location.search).get('level') ?? '1');
const level = builtInLevelFor(levelNumber);
const ghost = (dx: number) =>
  Array.from({ length: 40 }, (_, i) => ({
    x: level.ball.x + ((level.cup.x - level.ball.x) * i) / 39 + dx,
    y: level.ball.y - Math.sin((Math.PI * i) / 39) * 260 + ((level.cup.y - level.ball.y) * i) / 39,
  }));
const leaders = [
  { username: 'quietfox', score: 175 },
  { username: 'tea_and_maps', score: 150 },
  { username: 'Afraid-Emotion-6182', score: 140 },
];
const me = { username: 'Afraid-Emotion-6182', streak: 3, bestStreak: 5, total: 610, rank: 4 };
const round = {
  dayKey: '2026-11-24',
  dayNumber: levelNumber,
  level,
  status: 'open',
  closesAt: new Date(Date.now() + 5 * 3600e3).toISOString(),
  players: Number(new URLSearchParams(location.search).get('players') ?? '1284'),
  holesInOne: Number(new URLSearchParams(location.search).get('players') ?? '1284') > 0 ? 37 : 0,
};
let mine =
  state === 'sunk' ? { attempts: 3, sunk: { attempt: 3, stars: 2, score: 162, bonus: 32 } } : { attempts: 0, sunk: null as unknown };
const pile = Array.from({ length: state === 'fresh' ? 0 : 18 }, (_, i) => ({
  x: 40 + ((i * 97) % 290),
  y: 300 + ((i * 53) % 260),
  mine: i % 6 === 0,
  owner: i % 6 === 0 ? 'Afraid-Emotion-6182' : `player${i}`,
}));
const arts: Record<string, string> = {};
let material = 'paper';
const ghosts = state === 'sunk' ? [ghost(-20), ghost(0), ghost(25)] : [];

const community = [3, 5, 7].map((n, i) => ({
  id: String(i + 1),
  level: { ...builtInLevelFor(n), name: ['Lunch break chaos', 'Printer jam', 'The boss is watching'][i] ?? 'Level', author: ['quietfox', 'tea_and_maps', 'Afraid-Emotion-6182'][i] ?? null },
  author: ['quietfox', 'tea_and_maps', 'Afraid-Emotion-6182'][i] ?? 'someone',
  votes: [42, 17, 3][i] ?? 0,
  voted: i === 1,
}));

window.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes('/api/levels')) {
    if (url.endsWith('/vote')) return new Response(JSON.stringify({ type: 'vote', votes: 43 }), { status: 200 });
    if (init?.method === 'POST') return new Response(JSON.stringify({ type: 'submitted', id: '9' }), { status: 200 });
    return new Response(JSON.stringify({ type: 'levels', levels: community }), { status: 200 });
  }
  if (url.includes('/api/init')) {
    const body = { type: 'init', round, me: state === 'guest' ? null : me, mine: state === 'guest' ? null : mine, leaders, ghosts, pile, arts, material, todayPostId: null };
    return new Response(JSON.stringify(body), { status: 200 });
  }
  if (url.includes('/api/shot')) {
    const shot = JSON.parse(String(init?.body ?? '{}'));
    const attempts = (mine as { attempts: number }).attempts + 1;
    mine = shot.sunk ? { attempts, sunk: { attempt: attempts, stars: shot.stars, score: 150 + shot.stars * 25, bonus: 50 } } : { attempts, sunk: null };
    if (!shot.sunk && shot.rest) pile.push({ ...shot.rest, mine: true, owner: 'Afraid-Emotion-6182' });
    const body = { type: 'shot', mine, me, leaders, ghosts: shot.sunk ? [ghost(-20), ghost(25)] : [], pile, arts, counted: true };
    return new Response(JSON.stringify(body), { status: 200 });
  }
  if (url.includes('/api/ball')) {
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (body.art) arts['Afraid-Emotion-6182'] = body.art;
    else delete arts['Afraid-Emotion-6182'];
    material = body.material ?? 'paper';
    return new Response(JSON.stringify({ type: 'ball', art: body.art, material }), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};
