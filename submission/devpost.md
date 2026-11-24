# Devpost submission: Crumple

## Project name
Crumple

## Tagline (max 200 characters)
A daily trick shot drawn in ballpoint pen. Every miss stays on the table for the whole subreddit, bank off someone's ball and they get an assist, and the community votes tomorrow's level in.

## Links
- App listing: https://developers.reddit.com/apps/crowd-hunch
- Demo post: https://www.reddit.com/r/crowd_hunch_dev/ (open the newest "Crumple #" post; the pinned post explains how to play)
- Video: https://youtube.com/shorts/4k6fMUWD7r8
- Built with: devvit, devvit-web, react, typescript, tailwindcss, phaser, matter-js, hono, redis, web-audio-api, vite

## About the project

### Inspiration
Everyone has thrown a crumpled sheet of paper at a bin and missed. In an office the misses pile up on the floor and become part of the room. We wanted a daily game where that pile is the whole subreddit's: you don't just play the same level as everyone else, you play on the same floor, covered in everyone's misses.

### What it does
Crumple is a daily physics puzzle drawn in ballpoint pen on a notebook page. Everyone gets the same level each day: one paper ball, one wastebasket, and shelves, stress balls, fans and air vents in the way. Pull back anywhere, let go, get it in the bin.

- **Every miss stays on the table, for everyone.** A missed ball stays where it stopped, and it's solid. The subreddit shares one table, so through the day the level fills with everyone's misses and you can bank off them. Each player keeps one ball there, their latest miss, and the table holds 40 at most. Sink it while the table is still clean and you earn up to +50.
- **Assists.** When your shot goes in off someone else's ball, they get +5 and a shout-out in the shot name: "Assist from u/quietfox". The day's top assist is named in the results comment.
- **Draw your own ball.** Pick paper, rubber, tin or glass, then draw on it with a ballpoint, red pen, marker, highlighter or felt tip, and add stamps. The material changes the look and the sound, never the physics. Your ball is what you throw, what replays show, and what you leave on the table.
- **The subreddit makes tomorrow's level.** Anyone can build a level with shelves, stress balls, stars, fans and vents, and pick a rule for it. You have to beat it before sharing, and you can remix anyone's level with credit. The most upvoted level becomes the next day's level, with its maker's name on the post and a "level maker" flair.
- **Shots worth talking about.** A slow-motion moment as the ball reaches the bin, then a replay. Good shots get names: hole in one, swish, bank shot, through the vent, pinball, a 4-bounce ricochet. Share result copies a plain line for the comments that tells how you did without giving the shot away.
- **Twist days.** Every seventh day changes one rule for everyone: low gravity, a bouncy ball, a glass ball that shatters if it hits too hard, or a bin that dodges. A twist only runs if the server can still find a winning shot with it.
- **Stuck?** After three misses a hint pencils in the opening of a throw that goes in.
- **Daily loop:** a new level at 00:00 UTC, results pinned under yesterday’s post with the top scores and the most helpful miss, a streak in your user flair, a daily board and an all-time board. After you sink it, faint pencil lines show how other players got in.

### How we built it
- **Devvit Web** with a React and Tailwind client, a Hono server, Redis for rounds, shots, the shared table, drawn balls, levels and votes, and the scheduler for the daily rollover.
- **One physics engine for everything.** A fixed-step Matter.js simulation in shared code runs the game in the browser, checks every shared level on the server, and powers a script that brute-forces each built-in level (4,320 shots each) to prove it can be beaten with all its stars.
- **Phaser draws the page.** Every line is a seeded hand-drawn wobble, so doodles hold still between frames, and each level sketches itself in when you open it.
- **Sound is synthesised** with Web Audio: a lo-fi electric piano loop with vinyl crackle that ducks while you aim and holds its breath in slow motion, a slingshot launch, and hits that sound like the ball's material. Music and sounds have their own switches, and so do slow motion and replays. No audio files.
- **Fair play:** throws are counted on the server, not the client; shot reports are validated; drawn balls must be small PNGs; shared levels are re-checked by the server's own search for a winning shot before anyone sees them.

### Challenges we ran into
- **Making a shared table fair.** A table that fills up during the day makes evening play easier, so the score includes a clean table bonus that shrinks as the pile grows.
- **Trusting nobody, cheaply.** Re-simulating a player's exact shot on the server isn't reliable across browsers, because floating-point trig differs. Instead the server counts throws itself and proves each player-made level solvable with a grid search, which takes a fraction of a second.
- **Physics gotchas.** A ball created as static in Matter.js has no stored mass and turns into NaN when released; the first version of every level was unsolvable until we found it.
- **Difficulty you can measure.** Eyeballing levels gave us two that only 3 or 4 of 4,320 shots could sink. The checker now prints each level's hit rate, we tuned them to between 0.5% and 3%, and the daily rotation runs easiest first.
- **Assists that can't be farmed.** The client reports which pile balls a shot touched, and the server only credits owners who really have a ball on today's table and aren't the shooter.

### Accomplishments that we're proud of
- A daily game where the community shapes the level twice: by missing on it today, and by voting in tomorrow's.
- Every built-in level is proven beatable, with all its stars, by the same physics the game runs.
- A look that is ours: ballpoint doodles on lined paper, not a template.

### What we learned
The most Reddit thing a game can do is let people leave a mark that others have to deal with. A miss you can see, and bounce off, is more social than a leaderboard.

### What's next
- Weekly themes for community levels.
- Moving parts in the level editor.
- A season board that adds up assists and level-maker wins.
