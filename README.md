# Crumple

A daily trick-shot puzzle drawn in ballpoint pen on a notebook page. Everyone in the subreddit gets the same level each day: one crumpled paper ball, one wastebasket, and shelves, stress balls, fans and air vents in the way.

What makes it Crumple:

- **Every miss stays on the table, for everyone.** When your ball stops short, it stays where it landed, and it's solid. The whole subreddit shares one table, and you can bank off other players' balls. Each player keeps one ball there, their latest miss, up to 40 in all. Sink it while the table is still clean and you get a bonus of up to +50.
- **Assists.** When a shot goes in off your ball, you get +5 and your name in the shot: "Assist from u/you".
- **Draw your own ball.** Paper, rubber, tin or glass, with pens and stamps. The material changes the look and the sound, never the throw.
- **The subreddit makes tomorrow's level.** Anyone can build or remix a level, beat it, and share it. The most upvoted level becomes the next day's level, with its maker's name on the post.
- **Twist days.** Every seventh day changes one rule: low gravity, a bouncy ball, a glass ball, or a dodging bin.

## How to play

1. Open today's Crumple post and tap **Take your shot**.
2. Drag anywhere on the page and pull back. The dotted line shows the start of the throw and the ring shows its power.
3. Let go. Get the ball in the bin.
4. Missed? Your ball stays on the table; throw again. Each extra throw costs a little. After three misses, **Hint** pencils in the start of a throw that goes in.
5. Near the bin the game slows down, then replays the shot. Both can be turned off in **Settings**, next to music and sounds.

Scoring, counted on the server:

| | Points |
|---|---|
| In the bin | 100, minus 10 for each earlier throw (never below 30) |
| Each star collected on the way | +25 |
| Clean table bonus | up to +50, minus one for every ball on the table |
| Assist, when someone sinks off your ball | +5 |

Your first sink locks in the day's score. After that you can keep practising for stars. Sinking it on your first throw counts as a hole in one.

Once you're in, faint pencil lines show how other players got their ball in the bin, and the result card names your shot (hole in one, swish, bank shot, assist from u/…). **Share result** copies a plain line for the comments that doesn't give the shot away. Playing on consecutive days builds a streak shown in your user flair.

## Build a level

Tap **Levels**, then **Build your own**.

- **Shelf:** drag a line; the shelf follows its angle.
- **Stress ball:** tap to place a bouncy ball.
- **Star:** tap to place up to three.
- **Fan:** drag in the direction it should blow.
- **Vents:** tap twice; a ball entering one comes out of the other.
- **Ball / Bin** to place them, **Move** to drag anything, **Erase**, **Undo**.
- **Rule:** normal, or one of the twists.

Any level in the list can be remixed; the remix credits the original maker.

Before you can share a level, you have to get the ball in the bin yourself. The server then checks again: it searches for a winning shot with the same physics the game uses, and refuses levels that can't be beaten. Each player can share three levels a day and upvote others' levels once each.

## For moderators

- Installing the app opens the first level right away.
- Every day at 00:00 UTC the current level closes and its results are pinned as a comment. The most upvoted community level becomes the new day's level; if nobody voted, one of the built-in levels runs instead.
- Subreddit menu, **Crumple: open today's level**: opens today's level now, or jumps to it.
- **Crumple: post today's level again**: posts the open level under a fresh post.
- **Crumple: post the how-to-play guide**: posts a short guide and pins it.

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
# states: fresh, sunk, guest; level: 1 to 8; pile=N puts N missed balls on the table; twist=moon|bouncy|glass|moving-bin
```

On networks that block Reddit's DNS, the npm scripts load `tools/reddit-dns.cjs`, which resolves Reddit hosts over DNS-over-HTTPS for the CLI only.
