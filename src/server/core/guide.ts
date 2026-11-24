import { context, reddit } from '@devvit/web/server';
import { SCORE } from '../../shared/level';
import { ASSIST_POINTS } from './store';

export const GUIDE_TITLE = 'How to play Crumple';

export const GUIDE_TEXT = `Crumple is a daily trick shot. Everyone here gets the same level each day: get the paper ball into the bin.

**Throwing**

- Open today's Crumple post and tap **Take your shot**.
- Drag anywhere, pull back and let go. The dashed line shows how the ball will start flying.
- Each star you pass through is worth ${SCORE.star} points. Every extra throw costs ${SCORE.attemptPenalty}.
- Missed three times? Tap **Hint** for the opening of a throw that goes in.

**The shared table**

Your missed ball stays on the table for everyone for the rest of the day. Other players can bounce off it, and when a shot goes in off your ball you get an assist, worth ${ASSIST_POINTS} points. Each player keeps one ball there, their latest miss, so the earlier you play, the cleaner the table and the bigger your clean table bonus.

**Make it yours**

- **Draw your ball.** Pick paper, rubber, tin or glass and draw on it. Everyone sees it on the table and in replays. It changes the look and the sound, never the throw.
- **Build a level.** Open **Levels**, build one and beat it yourself, then share it. The most upvoted level becomes tomorrow's level for everyone, with your name on it. You can also remix someone else's.

**Every day**

A new level opens at midnight UTC. Every seventh day has a twist: low gravity, a bouncy ball, a glass ball that shatters, or a bin that dodges.

When the day closes, the top scores and the most helpful miss go in a pinned comment. Tap **Share result** to copy a line for the comments. It says how you did without giving away the shot.

Found a bug or have an idea? Leave a comment below.`;

/** Posts the how-to-play guide and pins it to the top of the subreddit. */
export async function postGuide(): Promise<string> {
  const { subredditName } = context;
  if (!subredditName) throw new Error('No subreddit in context');
  const post = await reddit.submitPost({ subredditName, title: GUIDE_TITLE, text: GUIDE_TEXT });
  await post.sticky(1);
  return post.id;
}
