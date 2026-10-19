import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { useApiQuery } from "../../hooks/useApiQuery";
import { useNow } from "../../hooks/useNow";
import { isEventCompleted, raceSessions, splitDuration, weekendRange } from "../../utils/format";
import { countryFlag } from "../../utils/flags";
import { teamHex } from "../../utils/constants";
import CircuitMap from "../circuit/CircuitMap";
import DriverAvatar from "../overview/DriverAvatar";
import Section from "../overview/Section";

const sessionTime = new Intl.DateTimeFormat("uk-UA", { weekday: "short", hour: "2-digit", minute: "2-digit" });

function Countdown({ ms }) {
  const t = splitDuration(ms);
  const units = [
    [t.days, "дн"],
    [t.hours, "год"],
    [t.minutes, "хв"],
    [t.seconds, "с"],
  ];
  return (
    <div className="flex gap-3" role="timer" aria-live="off">
      {units.map(([v, label]) => (
        <span key={label} className="flex flex-col items-center">
          <span className="font-mono-data text-2xl font-bold tabular-nums">{String(v).padStart(2, "0")}</span>
          <span className="text-[10px] uppercase tracking-widest text-(--color-text-dim)">{label}</span>
        </span>
      ))}
    </div>
  );
}

// Наступний етап: схема, відлік до найближчої сесії й розклад вікенду в
// часовому поясі користувача — те, по що найчастіше приходять на головну.
function NextEvent({ race, year, outline }) {
  const now = useNow(1000);
  const sessions = raceSessions(race);
  const next = sessions.find((s) => s.at.getTime() > now);
  const flag = countryFlag(race.Country);

  return (
    <section className="border border-(--color-line) bg-(--color-surface-2) rounded-md p-4 flex flex-col gap-3 shadow-[inset_0_3px_0_var(--color-accent)]">
      <h2 className="text-xs uppercase tracking-widest font-semibold text-(--color-accent)">Наступний етап · {race.RoundNumber}</h2>
      <div className="flex items-center gap-3 min-w-0">
        {outline && (
          <span className="w-20 h-14 shrink-0 text-(--color-accent)">
            <CircuitMap outline={outline} variant="thumb" className="w-full h-full" />
          </span>
        )}
        <div className="flex flex-col min-w-0">
          <span className="font-bold uppercase leading-tight">{race.EventName}</span>
          <span className="text-xs text-(--color-text-dim) truncate">
            {flag && <span className="mr-1">{flag}</span>}
            {race.Location} · <span className="font-mono-data">{weekendRange(race)}</span>
          </span>
        </div>
      </div>

      {next ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs text-(--color-text-dim)">
            До <span className="text-(--color-text) font-semibold">{next.code}</span> · {next.name}
          </span>
          <Countdown ms={next.at.getTime() - now} />
        </div>
      ) : (
        <p className="text-sm text-(--color-text-dim)">Вікенд триває — результати незабаром.</p>
      )}

      <ul className="flex flex-col text-sm border-t border-(--color-line) pt-2">
        {sessions.map((s) => {
          const past = s.at.getTime() <= now;
          return (
            <li key={s.code} className={`flex items-baseline justify-between gap-3 py-0.5 ${past ? "text-(--color-text-dim) line-through" : ""}`}>
              <span>
                <span className="font-mono-data text-(--color-accent) w-9 inline-block">{s.code}</span>
                {s.name}
              </span>
              <span className="font-mono-data text-xs text-(--color-text-dim)">{sessionTime.format(s.at)}</span>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-(--color-text-dim) -mt-1">Час — у вашому часовому поясі.</p>

      <div className="flex gap-2 flex-wrap">
        <Link
          to={`/${year}/${race.RoundNumber}/analysis`}
          className="text-xs uppercase tracking-wide font-semibold px-3.5 py-2 rounded-md bg-(--color-accent) text-white hover:brightness-110 transition-[filter]"
        >
          Прогноз моделі →
        </Link>
        <Link
          to={`/${year}/${race.RoundNumber}`}
          className="text-xs uppercase tracking-wide font-semibold px-3.5 py-2 rounded-md border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-accent) transition-colors"
        >
          Деталі етапу
        </Link>
      </div>
    </section>
  );
}

// Подіум останнього етапу — з CSV (event-summary), миттєво.
function LastEvent({ race, year }) {
  const { data } = useApiQuery(() => api.getEventSummary(year, race.RoundNumber), [year, race.RoundNumber]);
  return (
    <Section title={`Останній етап · ${race.RoundNumber}`} action={{ to: `/${year}/${race.RoundNumber}`, label: "Підсумок" }}>
      <span className="font-semibold uppercase text-sm -mt-1">{race.EventName}</span>
      {data?.podium ? (
        <ol className="flex flex-col">
          {data.podium.map((d) => (
            <li key={d.position} className="flex items-center gap-2.5 py-1">
              <span className={`font-mono-data text-xs w-5 ${d.position === 1 ? "text-(--color-accent) font-bold" : "text-(--color-text-dim)"}`}>
                P{d.position}
              </span>
              <DriverAvatar driver={d} size={26} />
              <span className="flex-1 min-w-0 truncate text-sm font-semibold">{d.full_name}</span>
              <span className="font-mono-data text-xs text-(--color-text-dim)">{d.position === 1 ? d.team : d.time_display}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-(--color-text-dim)">{data === null ? "Результатів ще немає в датасеті." : "…"}</p>
      )}
    </Section>
  );
}

function Leaders({ progress, year }) {
  const top = progress.drivers.slice(0, 3);
  const leader = top[0];
  return (
    <Section title={progress.final ? "Чемпіон сезону" : "Лідери чемпіонату"} action={{ to: `/${year}?tab=drivers`, label: "Таблиця" }}>
      <ol className="flex flex-col">
        {top.map((d) => (
          <li key={d.driver_ref}>
            <Link to={`/${year}/drivers/${d.driver_ref}`} className="flex items-center gap-2.5 py-1 group">
              <span className="font-mono-data text-xs w-5 text-(--color-text-dim)">{d.position}</span>
              <span className="w-1 h-5 rounded-sm" style={{ background: teamHex(d.team_color) }} aria-hidden="true" />
              <span className="flex-1 min-w-0 truncate text-sm font-semibold group-hover:text-(--color-accent) transition-colors">
                {d.full_name}
              </span>
              <span className="font-mono-data text-sm font-bold">{d.points}</span>
              <span className="font-mono-data text-xs text-(--color-text-dim) w-10 text-right">
                {d === leader ? "" : `−${d.gap_to_leader}`}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function SeasonProgress({ done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex flex-col gap-1.5" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={total} aria-label="Прогрес сезону">
      <div className="flex justify-between text-xs text-(--color-text-dim)">
        <span>
          Етапів позаду: <span className="font-mono-data text-(--color-text)">{done}</span> з{" "}
          <span className="font-mono-data">{total}</span>
        </span>
        <span className="font-mono-data">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-(--color-line) overflow-hidden">
        <div className="h-full bg-(--color-accent) rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// "Зараз у сезоні": наступний етап, останній подіум, лідери, прогрес. На
// десктопі — бічна колонка поруч із календарем, на телефоні — над ним.
export default function SeasonNow({ year, races, nextRace, lastRace, progress, circuits }) {
  const done = races.filter(isEventCompleted).length;
  return (
    <div className="flex flex-col gap-4">
      <SeasonProgress done={done} total={races.length} />
      {nextRace && <NextEvent race={nextRace} year={year} outline={circuits?.[nextRace.RoundNumber]} />}
      {lastRace && <LastEvent race={lastRace} year={year} />}
      {progress?.drivers?.length > 0 && <Leaders progress={progress} year={year} />}
    </div>
  );
}
