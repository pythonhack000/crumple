# Crumple

A daily trick-shot puzzle drawn in ballpoint pen on a notebook page. Everyone in the subreddit gets the same level each day: one crumpled paper ball, one wastebasket, and shelves, stress balls, fans and air vents in the way.

What makes it Crumple:

- **Every miss stays on the table, for everyone.** When your ball stops short, it stays where it landed, and it's solid. The whole subreddit shares one table, so by evening the level is covered in everyone's misses, and you can bank off them. Sink it while the table is still clean and you get a bonus of up to +50.
- **Draw your own ball.** Three pens and an eraser. Your drawing is the ball you throw, and it's what you leave on the table when you miss, so the pile shows whose miss is whose.
- **The subreddit makes tomorrow's level.** Anyone can build a level, beat it, and share it. The most upvoted level becomes the next day's level, with its maker's name on the post.

## How to play

1. Open today's Crumple post and tap **Take your shot**.
2. Drag anywhere on the page and pull back. The dotted line shows the start of the throw and the ring shows its power.
3. Let go. Get the ball in the bin.
4. Missed? Your ball stays on the table; throw again. Each extra throw costs a little.

Scoring, counted on the server:

| | Points |
|---|---|
| In the bin | 100, minus 10 for each earlier throw (never below 30) |
| Each star collected on the way | +25 |
| Clean table bonus | up to +50, minus one for every ball on the table |

Your first sink locks in the day's score. After that you can keep practising for stars. Sinking it on your first throw counts as a hole in one.

Once you're in, faint pencil lines show how other players got their ball in the bin. Playing on consecutive days builds a streak shown in your user flair.

## Build a level

Tap **Levels**, then **Build your own**.

- **Shelf:** drag a line; the shelf follows its angle.
- **Stress ball:** tap to place a bouncy ball.
- **Star:** tap to place up to three.
- **Fan:** drag in the direction it should blow.
- **Vents:** tap twice; a ball entering one comes out of the other.
- **Move ball / Move bin**, **Erase**, **Undo**.

Before you can share a level, you have to get the ball in the bin yourself. The server then checks again: it searches for a winning shot with the same physics the game uses, and refuses levels that can't be beaten. Each player can share three levels a day and upvote others' levels once each.

## For moderators

- Installing the app opens the first level right away.
- Every day at 00:00 UTC the current level closes and its results are pinned as a comment. The most upvoted community level becomes the new day's level; if nobody voted, one of the built-in levels runs instead.
- Subreddit menu, **Crumple: open today's level**: opens today's level now, or jumps to it.

## How it's built

- **Devvit Web:** a React and Tailwind client, a Hono server, Redis for rounds, shots, the shared table, drawn balls, levels and votes, and the scheduler for the daily rollover.
- **One physics engine for everything:** a fixed-step Matter.js simulation in `src/shared/sim.ts` runs the game in the browser, checks shared levels on the server, and powers `npm run check:levels`, which brute-forces every built-in level to prove it can be beaten with all its stars.
- **Phaser** draws the page: every line is a seeded hand-drawn wobble, so the doodles hold still between frames.
- **Sound** is synthesised with Web Audio: no audio files.
- **Fair play:** throws are counted on the server, shot reports are validated, drawn balls must be small PNGs, and shared levels are re-checked before anyone sees them.

## Development

```bash
npm install
npm run login          # once: sign in to Reddit
npm run dev            # playtest in your test subreddit
npm run test:unit      # physics, scoring, validation
npm run check:levels   # prove every built-in level can be beaten
npm run deploy         # type-check, lint and upload
```

`tools/preview` renders the game with canned data, without Reddit:

```bash
npx vite --config tools/preview/vite.config.ts
# open http://localhost:3061/tools/preview/game.html?state=fresh&level=1
# states: fresh, sunk, guest; level: 1 to 8
```

On networks that block Reddit's DNS, the npm scripts load `tools/reddit-dns.cjs`, which resolves Reddit hosts over DNS-over-HTTPS for the CLI only.
