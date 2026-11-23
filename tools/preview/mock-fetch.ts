// Serves canned API responses chosen by the ?state= query parameter.
const question = {
  prompt: 'You find a $20 bill on an empty street. You...',
  options: ['Keep it', 'Hand it to the police', 'Leave it there', 'Give it to the next person you see'],
};
const closesAt = new Date(Date.now() + 5 * 3600e3 + 12 * 60e3).toISOString();
const me = { username: 'bekha', streak: 4, bestStreak: 6, total: 17, played: 7, calledRight: 5, rank: 3 };
const leaders = [
  { username: 'quietfox', score: 31 },
  { username: 'tea_and_maps', score: 22 },
  { username: 'bekha', score: 17 },
  { username: 'loud_chewer', score: 12 },
  { username: 'm0untainview', score: 9 },
];
const base = { dayKey: '2026-12-01', dayNumber: 12, question, closesAt, players: 1284 };
const states: Record<string, unknown> = {
  open: { type: 'init', day: { ...base, status: 'open', myPick: null, myCall: null, result: null }, me, leaders, todayPostId: null },
  voted: { type: 'init', day: { ...base, status: 'open', myPick: 0, myCall: 1, result: null }, me, leaders, todayPostId: null },
  closed: {
    type: 'init',
    day: { ...base, status: 'closed', myPick: 0, myCall: 0, result: { shares: [46, 21, 9, 24], majority: [0], myPoints: 3 } },
    me, leaders, todayPostId: 't3_today',
  },
  guest: { type: 'init', day: { ...base, status: 'open', myPick: null, myCall: null, result: null }, me: null, leaders, todayPostId: null },
};
const state = new URLSearchParams(location.search).get('state') ?? 'open';
window.fetch = async (input) => {
  const url = String(input);
  if (url.includes('/api/init')) return new Response(JSON.stringify(states[state]), { status: 200 });
  if (url.includes('/api/vote')) return new Response(JSON.stringify({ ...(states.voted as object), type: 'vote' }), { status: 200 });
  return new Response('{}', { status: 404 });
};
