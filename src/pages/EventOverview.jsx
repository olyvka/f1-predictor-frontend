import { Link, useOutletContext, useParams } from "react-router-dom";
import { api } from "../api/client";
import { formatDateTime, isFuture } from "../utils/format";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { useApiQuery } from "../hooks/useApiQuery";
import { fetchCircuits } from "../utils/circuits";
import Section from "../components/overview/Section";
import RaceSummary from "../components/overview/RaceSummary";
import NextSession from "../components/overview/NextSession";
import PredictionCheck from "../components/overview/PredictionCheck";
import StandingsSnapshot from "../components/overview/StandingsSnapshot";
import CircuitCard from "../components/overview/CircuitCard";
import CircuitHistory from "../components/overview/CircuitHistory";
import { t } from "../i18n";

const rowBase = "-mx-2 px-2 rounded flex items-center gap-4 py-2 text-sm font-mono-data";

function SessionList({ sessions }) {
  return (
    <Section title={t("event.schedule")}>
      {/* Ті самі сесії, що й у табах вище, — рядок веде на сторінку сесії.
          Майбутні сесії не клікабельні, як і відповідні таби. */}
      <div className="flex flex-col">
        {sessions.map((s) => {
          const future = isFuture(s.date);
          const cells = (
            <>
              <span className="w-10 shrink-0 text-(--color-accent) font-semibold">{s.code}</span>
              <span className="flex-1 min-w-0 truncate">{s.name}</span>
              <span className="shrink-0 text-(--color-text-dim)">{formatDateTime(s.date)}</span>
            </>
          );

          if (future) {
            return (
              <div key={s.code} className={`${rowBase} opacity-50`} title={t("session.notYet")}>
                {cells}
                <span className="w-4 shrink-0" aria-hidden="true" />
              </div>
            );
          }
          return (
            <Link key={s.code} to={s.code} className={`${rowBase} group hover:bg-(--color-surface-hover) transition-colors`}>
              {cells}
              <span
                className="w-4 shrink-0 text-(--color-text-dim) group-hover:text-(--color-accent) transition-colors"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
          );
        })}
      </div>
    </Section>
  );
}

// Огляд етапу. Усі блоки, крім схеми траси, — з CSV-датасету бекенду
// (миттєво, без FastF1). Кожен блок вантажиться окремо й просто не
// показується, якщо даних немає або запит упав: вони доповнюють сторінку,
// а збій бекенду й так видно з табів сесій вище (EventLayout).
export default function EventOverview() {
  const { year, round } = useParams();
  const { event, sessions } = useOutletContext();

  useSetBreadcrumb(
    [
      { label: year, to: `/${year}` },
      { label: event ? event.EventName : t("chart.roundN", { round }) },
    ],
    [year, round, event?.EventName]
  );

  const circuits = useApiQuery(() => fetchCircuits(Number(year)), [year]);
  const summary = useApiQuery(() => api.getEventSummary(year, round), [year, round]);
  const standings = useApiQuery(() => api.getEventStandings(year, round), [year, round]);
  const history = useApiQuery(() => api.getCircuitHistory(year, round), [year, round]);
  const facts = useApiQuery(() => api.getCircuitFacts(year, round), [year, round]);
  const prediction = useApiQuery(() => api.getAnalysisStatus(year, round), [year, round]);

  if (!event) {
    return <p className="text-sm text-(--color-text-dim)">{t("event.loading")}</p>;
  }

  const allPast = sessions.length > 0 && sessions.every((s) => !isFuture(s.date));
  // Гонка минула, а в датасеті її ще немає — CSV оновлюється вручну.
  const resultsPending = allPast && !summary.loading && !summary.error && summary.data === null;

  return (
    <div className="flex flex-col gap-4">
      {summary.data ? <RaceSummary summary={summary.data} /> : <NextSession sessions={sessions} />}
      {resultsPending && (
        <p className="text-sm text-(--color-text-dim) border border-(--color-line) rounded-md px-4 py-3">
          {t("event.resultsPending")}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <SessionList sessions={sessions} />
          <PredictionCheck status={prediction.data} />
          {standings.data && <StandingsSnapshot standings={standings.data} year={year} />}
          <CircuitHistory history={history.data} />
        </div>
        <CircuitCard outline={circuits.data?.[round]} facts={facts.data} />
      </div>
    </div>
  );
}
