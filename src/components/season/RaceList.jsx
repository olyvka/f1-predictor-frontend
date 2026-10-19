import { Link } from "react-router-dom";
import { isEventCompleted, raceSessions, raceStartTime, shortCountdown, weekendRange } from "../../utils/format";
import { countryFlag } from "../../utils/flags";
import { useNow } from "../../hooks/useNow";
import CircuitMap from "../circuit/CircuitMap";
import DriverAvatar from "../overview/DriverAvatar";

// Заглушка там, де контуру траси немає (нові траси, яких ще немає в
// MultiViewer) — щоб рядок не мав порожньої дірки.
function CircuitPlaceholder() {
  return (
    <svg viewBox="0 0 48 32" className="w-full h-full" aria-hidden="true">
      <rect x="6" y="6" width="36" height="20" rx="9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
    </svg>
  );
}

// Права частина рядка: минулий етап — переможець, наступний — відлік,
// майбутній — час старту гонки. Статусів "Завершено"/"Попереду" більше
// немає: стан видно з самого рядка, а 17 однакових бейджів були шумом.
function RowStatus({ race, state, winner, now }) {
  if (state === "past") {
    if (!winner) {
      return <span className="text-xs text-(--color-text-dim)">результати очікуються</span>;
    }
    return (
      <span className="flex items-center gap-2" title={`Переможець: ${winner.full_name}`}>
        <DriverAvatar driver={winner} size={26} />
        <span className="font-mono-data text-sm font-semibold w-9">{winner.code || winner.full_name.split(" ").pop()}</span>
      </span>
    );
  }
  if (state === "next") {
    const nextSession = raceSessions(race).find((s) => s.at.getTime() > now);
    return (
      <span className="flex flex-col items-end gap-0.5">
        <span className="text-[10px] uppercase tracking-widest font-bold text-(--color-accent)">Наступний</span>
        <span className="text-xs font-mono-data text-(--color-text-dim)">
          {nextSession ? `${nextSession.code} ${shortCountdown(nextSession.at.getTime() - now)}` : "триває"}
        </span>
      </span>
    );
  }
  const start = raceStartTime(race);
  return start ? <span className="text-xs font-mono-data text-(--color-text-dim)">гонка {start}</span> : null;
}

export default function RaceList({ year, races, circuits = {}, winners = new Map(), nextRound }) {
  const now = useNow(60_000);

  if (!races.length) {
    return <p className="text-(--color-text-dim) text-sm px-1">Немає гонок для цього сезону.</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-(--color-line) border border-(--color-line) rounded-md overflow-hidden">
      {races.map((race) => {
        const state = race.RoundNumber === nextRound ? "next" : isEventCompleted(race) ? "past" : "future";
        const isSprint = race.EventFormat === "sprint_qualifying";
        const flag = countryFlag(race.Country);
        const outline = circuits[race.RoundNumber];

        return (
          <li key={race.RoundNumber}>
            <Link
              to={`/${year}/${race.RoundNumber}`}
              aria-current={state === "next" ? "step" : undefined}
              className={`group flex items-center gap-3 px-3 sm:px-4 py-2.5 min-w-0 transition-colors hover:bg-(--color-surface-hover) ${
                state === "next" ? "bg-(--color-surface-2) shadow-[inset_3px_0_0_var(--color-accent)]" : "bg-(--color-surface)"
              }`}
            >
              <span className="font-mono-data text-xs w-5 text-right text-(--color-text-dim) shrink-0">
                {String(race.RoundNumber).padStart(2, "0")}
              </span>
              <span
                className={`w-11 h-8 shrink-0 flex items-center justify-center transition-colors group-hover:text-(--color-accent) ${
                  state === "next" ? "text-(--color-accent)" : "text-(--color-text-dim)"
                } ${state === "future" ? "opacity-60" : ""}`}
              >
                {outline ? <CircuitMap outline={outline} variant="thumb" className="w-full h-full" /> : <CircuitPlaceholder />}
              </span>

              <span className="flex flex-col min-w-0 flex-1">
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`font-semibold tracking-wide uppercase text-sm truncate ${
                      state === "future" ? "text-(--color-text-dim)" : ""
                    }`}
                  >
                    {race.EventName}
                  </span>
                  {isSprint && (
                    <span className="shrink-0 text-[10px] uppercase tracking-wider font-semibold px-1.5 py-px rounded border border-(--color-line) text-(--color-text-dim)">
                      Спринт
                    </span>
                  )}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-(--color-text-dim) min-w-0">
                  {flag && (
                    <span className="leading-none" title={race.Country} aria-label={race.Country} role="img">
                      {flag}
                    </span>
                  )}
                  <span className="font-mono-data shrink-0">{weekendRange(race)}</span>
                  <span className="truncate hidden sm:inline">· {race.Location}</span>
                </span>
              </span>

              <span className="shrink-0">
                <RowStatus race={race} state={state} winner={winners.get(race.RoundNumber)} now={now} />
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
