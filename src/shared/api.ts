import type { Material } from './ball-art';
import type { Level, Point } from './level';

export type RoundStatus = 'open' | 'closed';

/** The day's round, as one player sees it. */
export type RoundView = {
  dayKey: string;
  dayNumber: number;
  level: Level;
  status: RoundStatus;
  /** ISO time this round closes. */
  closesAt: string;
  players: number;
  holesInOne: number;
};

/** One player's progress on one round. */
export type MyRound = {
  attempts: number;
  sunk: { attempt: number; stars: number; score: number; bonus: number } | null;
};

/** A missed ball lying on the shared table. */
export type PileBall = { x: number; y: number; mine: boolean; owner: string };

export type PlayerStats = {
  username: string;
  streak: number;
  bestStreak: number;
  total: number;
  rank: number | null;
};

export type LeaderRow = {
  username: string;
  score: number;
};

export type InitResponse = {
  type: 'init';
  round: RoundView;
  me: PlayerStats | null;
  mine: MyRound | null;
  /** Today's best, highest first. */
  leaders: LeaderRow[];
  /** Other players' sinking paths; sent once the player has sunk or the round closed. */
  ghosts: Point[][];
  /** Everyone's missed balls on today's shared table, oldest first. */
  pile: PileBall[];
  /** Drawn balls by username: the viewer's own and those of pile owners. */
  arts: Record<string, string>;
  /** What the viewer's ball is made of. */
  material: Material;
  /** Post of the round that is open now, when it is not this one. */
  todayPostId: string | null;
};

export type ShotRequest = {
  sunk: boolean;
  stars: number;
  path: Point[];
  /** Where a missed ball stopped, if it stayed on the table. */
  rest: Point | null;
  /** Players whose missed balls this sinking shot bounced off. */
  owners: string[];
};

export type ShotResponse = {
  type: 'shot';
  mine: MyRound;
  me: PlayerStats;
  leaders: LeaderRow[];
  ghosts: Point[][];
  pile: PileBall[];
  arts: Record<string, string>;
  /** False once the player already sank this round: the shot was practice. */
  counted: boolean;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};

export type BallArtResponse = {
  type: 'ball';
  art: string | null;
  material: Material;
};

/** A player-made level waiting for votes. */
export type CommunityLevel = {
  id: string;
  level: Level;
  author: string;
  votes: number;
  /** Whether the viewer already upvoted it. */
  voted: boolean;
};

export type LevelsResponse = {
  type: 'levels';
  levels: CommunityLevel[];
};

export type SubmitLevelResponse = {
  type: 'submitted';
  id: string;
};

export type VoteResponse = {
  type: 'vote';
  votes: number;
};
