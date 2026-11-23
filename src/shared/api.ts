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
  sunk: { attempt: number; stars: number; score: number } | null;
};

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
  /** Post of the round that is open now, when it is not this one. */
  todayPostId: string | null;
};

export type ShotRequest = {
  sunk: boolean;
  stars: number;
  path: Point[];
};

export type ShotResponse = {
  type: 'shot';
  mine: MyRound;
  me: PlayerStats;
  leaders: LeaderRow[];
  ghosts: Point[][];
  /** False once the player already sank this round: the shot was practice. */
  counted: boolean;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
