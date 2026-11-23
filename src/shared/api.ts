export type Question = {
  prompt: string;
  options: string[];
};

export type DayStatus = 'open' | 'closed';

/** One day's round, as one player sees it. */
export type DayView = {
  dayKey: string;
  dayNumber: number;
  question: Question;
  status: DayStatus;
  players: number;
  /** ISO time the round closes and the crowd's answer is revealed. */
  closesAt: string;
  myPick: number | null;
  myCall: number | null;
  /** Revealed only once the round is closed. */
  result: DayResult | null;
};

export type DayResult = {
  shares: number[];
  majority: number[];
  myPoints: number | null;
};

export type PlayerStats = {
  username: string;
  streak: number;
  bestStreak: number;
  total: number;
  played: number;
  calledRight: number;
  rank: number | null;
};

export type LeaderRow = {
  username: string;
  score: number;
};

export type InitResponse = {
  type: 'init';
  day: DayView;
  me: PlayerStats | null;
  leaders: LeaderRow[];
  /** Post of the round that is open right now, when it is not this one. */
  todayPostId: string | null;
};

export type VoteRequest = {
  pick: number;
  call: number;
};

export type VoteResponse = {
  type: 'vote';
  day: DayView;
  me: PlayerStats;
};

export type ErrorResponse = {
  status: 'error';
  message: string;
};
