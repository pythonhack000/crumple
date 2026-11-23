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
  players: 1284,
  holesInOne: 37,
};
let mine =
  state === 'sunk' ? { attempts: 3, sunk: { attempt: 3, stars: 2, score: 130 } } : { attempts: 0, sunk: null as unknown };
const ghosts = state === 'sunk' ? [ghost(-20), ghost(0), ghost(25)] : [];

window.fetch = async (input, init) => {
  const url = String(input);
  if (url.includes('/api/init')) {
    const body = { type: 'init', round, me: state === 'guest' ? null : me, mine: state === 'guest' ? null : mine, leaders, ghosts, todayPostId: null };
    return new Response(JSON.stringify(body), { status: 200 });
  }
  if (url.includes('/api/shot')) {
    const shot = JSON.parse(String(init?.body ?? '{}'));
    const attempts = (mine as { attempts: number }).attempts + 1;
    mine = shot.sunk ? { attempts, sunk: { attempt: attempts, stars: shot.stars, score: 100 + shot.stars * 25 } } : { attempts, sunk: null };
    const body = { type: 'shot', mine, me, leaders, ghosts: shot.sunk ? [ghost(-20), ghost(25)] : [], counted: true };
    return new Response(JSON.stringify(body), { status: 200 });
  }
  return new Response('{}', { status: 404 });
};
