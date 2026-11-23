# Hunch

A daily game about reading people. Every day there is one question with a few answers and no right one. You give your own answer, then make your hunch: which answer will most people in the subreddit pick? At midnight UTC the round closes, the crowd's answer is revealed, and everyone who read the crowd right scores.

## How to play

1. Open today's Hunch post and tap **Play**.
2. **Step 1:** pick your own answer. Be honest; your answer counts toward the crowd.
3. **Step 2:** pick the answer you think most people chose.
4. Come back after midnight UTC. Yesterday's post shows the results, and a pinned comment sums them up.

Scoring:

- **+3** if your hunch matches the crowd's top answer (any answer tied for the top counts).
- **+1** if your hunch was the clear second place.
- Play on consecutive days to build a streak. Your streak shows in your user flair.

The leaderboard ranks the best crowd readers by total points.

## For moderators

- Installing the app opens the first round right away.
- A new round opens every day at 00:00 UTC; the previous round closes and its results are posted.
- Subreddit menu, **Hunch: queue a question**: add your own question with 2 to 4 answers. Queued questions run before the built-in ones, oldest first.
- Subreddit menu, **Hunch: open today's round**: opens today's round now if it is not up yet, or jumps to it.

## Built with

Devvit Web: React, Tailwind CSS and Vite on the client, Hono on the server, Redis for rounds, votes, streaks and the leaderboard, and the Devvit scheduler for the daily rollover.

## Development

```bash
npm install
npm run login      # once: sign in to Reddit
npm run dev        # playtest in your test subreddit
npm run test:unit  # scoring, streak and date logic
npm run deploy     # type-check, lint and upload
```

`tools/preview` renders every screen with canned data, without Reddit:

```bash
npx vite --config tools/preview/vite.config.ts
# then open http://localhost:3061/tools/preview/game.html?state=open
# states: open, voted, closed, guest
```
