import './index.css';

import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { navigateToPost, showLoginPrompt, showShareSheet } from '@devvit/web/client';
import type { DayView, InitResponse } from '../shared/api';
import { CALL_POINTS } from '../shared/game';
import { Leaderboard, OptionList, ResultBars, StatsLine } from './components';
import { people, timeLeft, useNow } from './time';
import { useHunch } from './useHunch';

type Step = 'pick' | 'call';

function Header({ day }: { day: DayView }) {
  return (
    <header className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Hunch #{day.dayNumber}, {people(day.players)} played
      </p>
      <h1 className="font-display text-[1.9rem] font-bold leading-[1.1] tracking-[-0.01em] text-balance">
        {day.question.prompt}
      </h1>
    </header>
  );
}

type PlayProps = {
  day: DayView;
  isLoggedIn: boolean;
  isVoting: boolean;
  voteError: string | null;
  onVote: (pick: number, call: number) => void;
};

function Play({ day, isLoggedIn, isVoting, voteError, onVote }: PlayProps) {
  const [step, setStep] = useState<Step>('pick');
  const [pick, setPick] = useState<number | null>(null);
  const [call, setCall] = useState<number | null>(null);

  if (!isLoggedIn) {
    return (
      <section className="flex flex-col gap-4">
        <p className="text-muted">Log in to answer and get your hunch scored tonight.</p>
        <button type="button" className="h-12 rounded-full bg-ink font-semibold text-paper" onClick={showLoginPrompt}>
          Log in to play
        </button>
      </section>
    );
  }

  const isPickStep = step === 'pick';
  const selected = isPickStep ? pick : call;
  const handleNext = () => {
    if (isPickStep) setStep('call');
    else if (pick !== null && call !== null) onVote(pick, call);
  };

  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted">Step {isPickStep ? 1 : 2} of 2</p>
        <h2 className="text-lg font-semibold">
          {isPickStep ? 'What’s your answer?' : 'Now, what will most people pick?'}
        </h2>
        {!isPickStep && (
          <p className="text-muted">
            +{CALL_POINTS.majority} if you read the crowd right, +{CALL_POINTS.runnerUp} for second place.
          </p>
        )}
      </div>
      <OptionList
        options={day.question.options}
        selected={selected}
        onSelect={isPickStep ? setPick : setCall}
        disabled={isVoting}
      />
      {voteError && (
        <p role="alert" className="text-sm font-medium">
          {voteError}
        </p>
      )}
      <div className="flex gap-2">
        {!isPickStep && (
          <button
            type="button"
            className="h-12 rounded-full border-2 border-line px-5 font-semibold"
            onClick={() => setStep('pick')}
            disabled={isVoting}
          >
            Back
          </button>
        )}
        <button
          type="button"
          className="h-12 flex-1 rounded-full bg-ink font-semibold text-paper disabled:opacity-40"
          disabled={selected === null || isVoting}
          onClick={handleNext}
        >
          {isPickStep ? 'Next' : isVoting ? 'Locking in…' : 'Lock it in'}
        </button>
      </div>
    </section>
  );
}

function LockedIn({ day }: { day: DayView }) {
  const now = useNow();
  const answer = day.myPick === null ? '' : day.question.options[day.myPick];
  const hunch = day.myCall === null ? '' : day.question.options[day.myCall];
  const handleShare = () =>
    void showShareSheet({ title: 'Hunch', text: `Can you read the crowd? ${day.question.prompt}` }).catch(
      (error: unknown) => console.error('Share failed', error)
    );

  return (
    <section className="flex flex-col gap-3">
      <p className="text-lg">
        You said <strong>{answer}</strong>. Your hunch is that most people said <strong>{hunch}</strong>.
      </p>
      <p className="text-muted">
        The crowd’s answer is revealed in {timeLeft(day.closesAt, now)}. Argue your case in the comments meanwhile.
      </p>
      <button type="button" className="h-12 rounded-full border-2 border-ink font-semibold" onClick={handleShare}>
        Challenge a friend
      </button>
    </section>
  );
}

function verdict(points: number | null): string {
  if (points === null) return 'You sat this one out. Here’s how the crowd went.';
  if (points === CALL_POINTS.majority) return `You read the crowd. +${points}`;
  if (points === CALL_POINTS.runnerUp) return `Close: second place. +${points}`;
  return 'The crowd went the other way.';
}

function Results({ day, todayPostId }: { day: DayView; todayPostId: string | null }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-display text-xl font-bold">{verdict(day.result?.myPoints ?? null)}</h2>
      <ResultBars day={day} />
      {todayPostId && (
        <button
          type="button"
          className="h-12 rounded-full bg-ink font-semibold text-paper"
          onClick={() => navigateToPost(todayPostId as `t3_${string}`)}
        >
          Play today’s question
        </button>
      )}
    </section>
  );
}

function Round({ data, isVoting, voteError, onVote }: {
  data: InitResponse;
  isVoting: boolean;
  voteError: string | null;
  onVote: (pick: number, call: number) => void;
}) {
  const { day, me, leaders } = data;
  const hasVoted = day.myPick !== null;
  let body;
  if (day.status === 'closed') body = <Results day={day} todayPostId={data.todayPostId} />;
  else if (hasVoted) body = <LockedIn day={day} />;
  else body = <Play day={day} isLoggedIn={me !== null} isVoting={isVoting} voteError={voteError} onVote={onVote} />;

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col gap-8 px-4 py-6">
      <Header day={day} />
      {body}
      {me && (hasVoted || day.status === 'closed') && <StatsLine me={me} />}
      {(hasVoted || day.status === 'closed') && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Best crowd readers</h2>
          <Leaderboard leaders={leaders} username={me?.username} />
        </section>
      )}
    </main>
  );
}

export function App() {
  const { state, reload, vote, voting, voteError } = useHunch();

  if (state.status === 'loading') {
    return <p className="p-6 text-muted">Loading today’s question…</p>;
  }
  if (state.status === 'error') {
    return (
      <main className="flex flex-col gap-3 p-6">
        <p>{state.message}</p>
        <button type="button" className="h-11 self-start rounded-full bg-ink px-5 font-semibold text-paper" onClick={() => void reload()}>
          Try again
        </button>
      </main>
    );
  }
  return (
    <Round
      data={state.data}
      isVoting={voting}
      voteError={voteError}
      onVote={(pick, call) => void vote({ pick, call })}
    />
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
