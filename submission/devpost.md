# Devpost submission: Crumple

## Project name
Crumple

## Tagline (max 200 characters)
A daily trick shot drawn in ballpoint pen. Every miss stays on the table for the whole subreddit, you draw your own ball, and the community votes tomorrow's level in.

## Links
- App listing: https://developers.reddit.com/apps/crowd-hunch
- Demo post: https://www.reddit.com/r/crowd_hunch_dev/ (open the newest "Crumple #" post)
- Built with: devvit, devvit-web, react, typescript, tailwindcss, phaser, matter-js, hono, redis, web-audio-api, vite

## About the project

### Inspiration
Everyone has thrown a crumpled sheet of paper at a bin and missed. In an office the misses pile up on the floor and become part of the room. We wanted a daily game where that pile is the whole subreddit's: you don't just play the same level as everyone else, you play on the same floor, covered in everyone's misses.

### What it does
Crumple is a daily physics puzzle drawn in ballpoint pen on a notebook page. Everyone gets the same level each day: one paper ball, one wastebasket, and shelves, stress balls, fans and air vents in the way. Pull back anywhere, let go, get it in the bin.

- **Every miss stays on the table, for everyone.** A missed ball stays where it stopped, and it's solid. The subreddit shares one table, so by evening the level is covered in everyone's misses and you can bank off them. Sink it while the table is still clean and you earn up to +50: early players face the harder table and are paid for it.
- **Draw your own ball.** Three pens and an eraser. Your drawing is what you throw, and it's what you leave behind when you miss, so the pile shows whose miss is whose.
- **The subreddit makes tomorrow's level.** Anyone can build a level with shelves, stress balls, stars, fans and vents, but has to beat it before sharing. The most upvoted level becomes the next day's level, with its maker's name on the post and a "level maker" flair.
- **Daily loop:** a new level at 00:00 UTC, results pinned under yesterday's post, a streak in your user flair, a daily board and an all-time board. After you sink it, faint pencil lines show how other players got in.

### How we built it
- **Devvit Web** with a React and Tailwind client, a Hono server, Redis for rounds, shots, the shared table, drawn balls, levels and votes, and the scheduler for the daily rollover.
- **One physics engine for everything.** A fixed-step Matter.js simulation in shared code runs the game in the browser, checks every shared level on the server, and powers a script that brute-forces each built-in level (4,320 shots each) to prove it can be beaten with all its stars.
- **Phaser draws the page.** Every line is a seeded hand-drawn wobble, so doodles hold still between frames, and each level sketches itself in when you open it.
- **Sound is synthesised** with Web Audio: paper rustle, thuds, a stress ball boing, the bin's thunk, and a quiet lo-fi loop. No audio files.
- **Fair play:** throws are counted on the server, not the client; shot reports are validated; drawn balls must be small PNGs; shared levels are re-checked by the server's own search for a winning shot before anyone sees them.

### Challenges we ran into
- **Making a shared table fair.** A table that fills up during the day makes evening play easier, so the score includes a clean table bonus that shrinks as the pile grows.
- **Trusting nobody, cheaply.** Re-simulating a player's exact shot on the server isn't reliable across browsers, because floating-point trig differs. Instead the server counts throws itself and proves each player-made level solvable with a grid search, which takes a fraction of a second.
- **Physics gotchas.** A ball created as static in Matter.js has no stored mass and turns into NaN when released; the first version of every level was unsolvable until we found it.

### Accomplishments that we're proud of
- A daily game where the community shapes the level twice: by missing on it today, and by voting in tomorrow's.
- Every built-in level is proven beatable, with all its stars, by the same physics the game runs.
- A look that is ours: ballpoint doodles on lined paper, not a template.

### What we learned
The most Reddit thing a game can do is let people leave a mark that others have to deal with. A miss you can see, and bounce off, is more social than a leaderboard.

### What's next
- Weekly themes for community levels.
- A "rescue" bonus for sinking off another player's miss, credited to them.
- Moving parts in the level editor.
