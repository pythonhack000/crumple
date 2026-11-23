import type { DayView, LeaderRow, PlayerStats } from '../shared/api';

type OptionListProps = {
  options: string[];
  selected: number | null;
  onSelect: (index: number) => void;
  disabled?: boolean;
};

export function OptionList({ options, selected, onSelect, disabled = false }: OptionListProps) {
  return (
    <ul className="flex flex-col gap-2" role="radiogroup">
      {options.map((option, index) => {
        const isSelected = selected === index;
        return (
          <li key={option}>
            <button
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onSelect(index)}
              className={`w-full min-h-12 rounded-xl border-2 px-4 py-3 text-left text-[1.05rem] leading-snug transition-colors disabled:opacity-60 ${
                isSelected
                  ? 'border-ink bg-ink text-paper'
                  : 'border-line bg-sheet text-ink hover:border-muted'
              }`}
            >
              {option}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

type ResultBarsProps = {
  day: DayView;
};

export function ResultBars({ day }: ResultBarsProps) {
  const result = day.result;
  if (!result) return null;
  return (
    <ul className="flex flex-col gap-3">
      {day.question.options.map((option, index) => {
        const share = result.shares[index] ?? 0;
        const isMajority = result.majority.includes(index);
        const marks = [day.myPick === index ? 'your answer' : null, day.myCall === index ? 'your hunch' : null]
          .filter(Boolean)
          .join(' and ');
        return (
          <li key={option}>
            <div className="flex items-baseline justify-between gap-3">
              <span className={`text-[1.05rem] ${isMajority ? 'marker -ml-1.5 px-1.5 py-0.5 font-semibold' : ''}`}>{option}</span>
              <span className="font-display text-xl font-bold tabular-nums">{share}%</span>
            </div>
            <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <div
                className={`bar-fill h-full rounded-full ${isMajority ? 'bg-marker' : 'bg-muted'}`}
                style={{ width: `${share}%` }}
              />
            </div>
            {marks && <p className="mt-1 text-sm text-muted">{marks.charAt(0).toUpperCase() + marks.slice(1)}</p>}
          </li>
        );
      })}
    </ul>
  );
}

type StatsLineProps = {
  me: PlayerStats;
};

export function StatsLine({ me }: StatsLineProps) {
  const items = [
    { value: me.streak, label: me.streak === 1 ? 'day streak' : 'days streak' },
    { value: me.total, label: me.total === 1 ? 'point' : 'points' },
    { value: me.rank ? `#${me.rank}` : '–', label: 'on the board' },
  ];
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col-reverse">
          <dt className="text-sm text-muted">{item.label}</dt>
          <dd className="font-display text-2xl font-bold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

type LeaderboardProps = {
  leaders: LeaderRow[];
  username: string | undefined;
};

export function Leaderboard({ leaders, username }: LeaderboardProps) {
  if (leaders.length === 0) {
    return <p className="text-muted">The board fills up when the first round closes. Be on it.</p>;
  }
  return (
    <ol className="flex flex-col">
      {leaders.map((row, index) => (
        <li
          key={row.username}
          className={`flex items-baseline gap-3 border-b border-line py-2 last:border-b-0 ${
            row.username === username ? 'font-semibold' : ''
          }`}
        >
          <span className="w-6 tabular-nums text-muted">{index + 1}</span>
          <span className="flex-1 truncate">u/{row.username}</span>
          <span className="tabular-nums">{row.score}</span>
        </li>
      ))}
    </ol>
  );
}
