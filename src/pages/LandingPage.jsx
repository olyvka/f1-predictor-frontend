import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useNow } from "../hooks/useNow";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { isEventCompleted, raceSessions, weekendRange } from "../utils/format";
import { countryFlag } from "../utils/flags";
import { fetchCircuits } from "../utils/circuits";
import { teamHex } from "../utils/constants";
import CircuitMap from "../components/circuit/CircuitMap";
import { Countdown } from "../components/season/SeasonNow";
import { t } from "../i18n";

const YEAR = new Date().getFullYear();

const PRIMARY_BTN =
  "inline-flex items-center gap-2 text-sm uppercase tracking-wide font-semibold px-5 py-3 rounded-md bg-(--color-accent) text-white hover:brightness-110 transition-[filter]";
const SECONDARY_BTN =
  "inline-flex items-center gap-2 text-sm uppercase tracking-wide font-semibold px-5 py-3 rounded-md border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-accent) transition-colors";

function Eyebrow({ children }) {
  return <p className="text-xs uppercase tracking-[0.2em] font-semibold text-(--color-accent)">{children}</p>;
}

function SectionHead({ eyebrow, title, lead }) {
  return (
    <div className="flex flex-col gap-2 max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-2xl sm:text-3xl font-extrabold">{title}</h2>
      {lead && <p className="text-(--color-text-dim)">{lead}</p>}
    </div>
  );
}

// "Зараз у сезоні": наступна гонка зі схемою й відліком, лідери чемпіонату
// і — одним рядком — вибір моделі (вона доповнює аналітику, а не головна).
function SeasonCard({ race, outline, progress, status }) {
  const now = useNow(1000);
  const next = raceSessions(race).find((s) => s.at.getTime() > now);
  const flag = countryFlag(race.Country);
  const leaders = progress?.drivers?.slice(0, 3) || [];
  const pick = status?.ready ? status.top3[0] : null;

  return (
    <div className="relative border border-(--color-line) bg-(--color-surface) rounded-xl p-5 sm:p-6 flex flex-col gap-4 shadow-[inset_0_3px_0_var(--color-accent)]">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs uppercase tracking-widest font-semibold text-(--color-accent)">
          {t("landing.nextRace", { round: race.RoundNumber })}
        </span>
        <span className="text-xs text-(--color-text-dim) font-mono-data">{weekendRange(race)}</span>
      </div>
      <Link to={`/${YEAR}/${race.RoundNumber}`} className="group">
        <h2 className="text-xl font-extrabold uppercase leading-tight group-hover:text-(--color-accent) transition-colors">{race.EventName}</h2>
        <p className="text-sm text-(--color-text-dim)">
          {flag && <span className="mr-1">{flag}</span>}
          {race.Location}, {race.Country}
        </p>
      </Link>

      {outline && (
        <div className="h-36 sm:h-44 text-(--color-accent)">
          <CircuitMap outline={outline} className="w-full h-full" />
        </div>
      )}

      {next && (
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <span className="text-xs text-(--color-text-dim)">
            {t("seasonNow.until")} <span className="text-(--color-text) font-semibold">{next.code}</span> · {next.name}
          </span>
          <Countdown ms={next.at.getTime() - now} />
        </div>
      )}

      {leaders.length > 0 && (
        <div className="border-t border-(--color-line) pt-3 flex flex-col gap-1.5">
          <span className="text-xs uppercase tracking-widest text-(--color-text-dim)">
            {progress.final ? t("seasonNow.champion") : t("seasonNow.leaders")}
          </span>
          <ol className="flex flex-col">
            {leaders.map((d, i) => (
              <li key={d.driver_ref}>
                <Link to={`/${YEAR}/drivers/${d.driver_ref}`} className="flex items-center gap-2.5 py-0.5 text-sm group">
                  <span className="font-mono-data text-xs w-4 text-(--color-text-dim)">{d.position}</span>
                  <span className="w-1 h-4 rounded-sm" style={{ background: teamHex(d.team_color) }} aria-hidden="true" />
                  <span className="flex-1 min-w-0 truncate font-semibold group-hover:text-(--color-accent) transition-colors">{d.full_name}</span>
                  <span className="font-mono-data font-bold">{d.points}</span>
                  <span className="font-mono-data text-xs text-(--color-text-dim) w-9 text-right">{i === 0 ? "" : `−${d.gap_to_leader}`}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Link
        to={`/${YEAR}/${race.RoundNumber}/analysis`}
        className="flex items-center gap-3 rounded-md border border-dashed border-(--color-line) px-3 py-2 text-sm hover:border-(--color-accent) transition-colors"
      >
        <span className="text-[10px] uppercase tracking-widest font-semibold text-(--color-accent) shrink-0">{t("landing.mlBadge")}</span>
        <span className="flex-1 min-w-0 truncate text-(--color-text-dim)">
          {pick ? (
            <>
              {t("landing.modelPicks")} <span className="text-(--color-text) font-semibold">{pick.driver}</span>
            </>
          ) : (
            t("landing.compute")
          )}
        </span>
        <span className="text-(--color-text-dim)">→</span>
      </Link>
    </div>
  );
}

const FEATURES = [
  { key: "calendar", to: () => `/${YEAR}` },
  { key: "sessions", to: (r) => (r ? `/${YEAR}/${r}` : `/${YEAR}`) },
  { key: "drivers", to: () => `/${YEAR}?tab=drivers` },
  { key: "teams", to: () => `/${YEAR}?tab=teams` },
  { key: "compare", to: (r) => (r ? `/${YEAR}/${r}` : `/${YEAR}`) },
  { key: "history", to: (r) => (r ? `/${YEAR}/${r}` : `/${YEAR}`) },
];

// Головне — аналітика: що можна подивитись у дашборді.
function Analytics({ lastRound }) {
  return (
    <section className="flex flex-col gap-5">
      <SectionHead eyebrow={t("landing.featuresEyebrow")} title={t("landing.featuresTitle")} lead={t("landing.featuresLead")} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FEATURES.map((item) => (
          <Link
            key={item.key}
            to={item.to(lastRound)}
            className="group flex flex-col gap-2 p-5 border border-(--color-line) bg-(--color-surface) rounded-lg hover:border-(--color-accent) transition-colors"
          >
            <h3 className="font-bold group-hover:text-(--color-accent) transition-colors">{t(`landing.features.${item.key}.title`)}</h3>
            <p className="text-sm text-(--color-text-dim)">{t(`landing.features.${item.key}.text`)}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Metric({ value, label, hint }) {
  return (
    <div className="flex flex-col gap-1 p-4 border border-(--color-line) bg-(--color-bg) rounded-lg">
      <span className="font-mono-data text-2xl sm:text-3xl font-bold">{value}</span>
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-xs text-(--color-text-dim)">{hint}</span>
    </div>
  );
}

const pct = (v) => `${Math.round(v * 100)}%`;
const STEPS = ["data", "features", "model", "explain"];

// Окремий акцент: модель — як додаткова можливість поверх аналітики.
function ModelBonus({ metrics, nextRound, lastRace, lastStatus }) {
  return (
    <section className="relative overflow-hidden border border-(--color-line) bg-(--color-surface) rounded-xl p-5 sm:p-8 flex flex-col gap-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -right-32 w-96 h-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--color-accent), transparent 65%)" }}
      />
      <div className="relative flex flex-col lg:flex-row lg:items-end gap-4 justify-between">
        <SectionHead eyebrow={t("landing.bonusEyebrow")} title={t("landing.bonusTitle")} lead={t("landing.bonusLead")} />
        {nextRound && (
          <Link to={`/${YEAR}/${nextRound}/analysis`} className={`${PRIMARY_BTN} self-start lg:self-auto shrink-0`}>
            {t("landing.nextPrediction")} →
          </Link>
        )}
      </div>

      {metrics && (
        <div className="relative flex flex-col gap-2">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {metrics.top1 != null && <Metric value={pct(metrics.top1)} label={t("landing.mTop1")} hint={t("landing.mTop1Hint")} />}
            {metrics.podium_set != null && <Metric value={pct(metrics.podium_set)} label={t("landing.mPodium")} hint={t("landing.mPodiumHint")} />}
            {metrics.top10_set != null && <Metric value={pct(metrics.top10_set)} label={t("landing.mTop10")} hint={t("landing.mTop10Hint")} />}
            {metrics.mae_test != null && <Metric value={metrics.mae_test.toFixed(1)} label={t("landing.mMae")} hint={t("landing.mMaeHint")} />}
          </div>
          <p className="text-xs text-(--color-text-dim)">{t("landing.qualityNote")}</p>
          {lastRace && lastStatus?.hits != null && (
            <p className="text-sm text-(--color-text-dim)">
              {t("landing.lastCheck", { race: lastRace.EventName, hits: lastStatus.hits })}{" "}
              <Link to={`/${YEAR}/${lastRace.RoundNumber}/analysis`} className="text-(--color-accent) hover:brightness-125">
                {t("landing.compare")} →
              </Link>
            </p>
          )}
        </div>
      )}

      <ol className="relative grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 border-t border-(--color-line) pt-5">
        {STEPS.map((step, i) => (
          <li key={step} className="flex flex-col gap-1">
            <span className="font-mono-data text-xs text-(--color-accent)">0{i + 1} · {t(`landing.steps.${step}.title`)}</span>
            <p className="text-sm text-(--color-text-dim)">{t(`landing.steps.${step}.text`)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Стартова сторінка: аналітичний дашборд Формули 1, прогнозна модель —
// окремим акцентом нижче. Сам дашборд — на /:year.
export default function LandingPage() {
  useSetBreadcrumb([], []);

  const { data: races } = useApiQuery(() => api.getRaces(YEAR), []);
  const { data: progress } = useApiQuery(() => api.getSeasonProgress(YEAR), []);
  const { nextRace, lastRace, done, total } = useMemo(() => {
    const list = (races || []).filter((r) => r.RoundNumber > 0);
    const completed = list.filter(isEventCompleted);
    return { nextRace: list.find((r) => !isEventCompleted(r)), lastRace: completed[completed.length - 1], done: completed.length, total: list.length };
  }, [races]);

  const { data: nextStatus } = useApiQuery(
    () => (nextRace ? api.getAnalysisStatus(YEAR, nextRace.RoundNumber) : Promise.resolve(null)),
    [nextRace?.RoundNumber]
  );
  const { data: lastStatus } = useApiQuery(
    () => (lastRace ? api.getAnalysisStatus(YEAR, lastRace.RoundNumber) : Promise.resolve(null)),
    [lastRace?.RoundNumber]
  );

  const [circuits, setCircuits] = useState(null);
  useEffect(() => {
    let alive = true;
    fetchCircuits(YEAR).then((c) => alive && setCircuits(c));
    return () => {
      alive = false;
    };
  }, []);

  const metrics = nextStatus?.metrics || lastStatus?.metrics;

  return (
    <div className="flex flex-col gap-16 sm:gap-20 pb-8">
      <section className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 items-center pt-2 sm:pt-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 w-[32rem] h-[32rem] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, var(--color-accent), transparent 65%)" }}
        />
        <div className="relative flex flex-col gap-6">
          <Eyebrow>{total ? t("landing.seasonEyebrow", { year: YEAR, done, total }) : t("landing.eyebrow")}</Eyebrow>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase leading-[1.02] tracking-tight">
            {t("landing.titleA")} <span className="text-(--color-accent)">{t("landing.titleB")}</span>
          </h1>
          <p className="text-base sm:text-lg text-(--color-text-dim) max-w-xl">{t("landing.lead")}</p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/${YEAR}`} className={PRIMARY_BTN}>
              {t("landing.openDashboard")} →
            </Link>
            <Link to={`/${YEAR}?tab=drivers`} className={SECONDARY_BTN}>
              {t("landing.standings")}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-(--color-text-dim)">
            {["facts.data", "facts.sessions", "facts.models"].map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent)" aria-hidden="true" />
                {t(`landing.${k}`)}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative">
          {nextRace ? (
            <SeasonCard race={nextRace} outline={circuits?.[nextRace.RoundNumber]} progress={progress} status={nextStatus} />
          ) : (
            races && (
              <div className="border border-(--color-line) bg-(--color-surface) rounded-xl p-6 text-(--color-text-dim)">
                {t("landing.seasonOver", { year: YEAR })}
              </div>
            )
          )}
        </div>
      </section>

      <Analytics lastRound={lastRace?.RoundNumber} />
      <ModelBonus metrics={metrics} nextRound={nextRace?.RoundNumber} lastRace={lastRace} lastStatus={lastStatus} />

      <section className="flex flex-col items-center text-center gap-4 px-6 py-6">
        <h2 className="text-2xl sm:text-3xl font-extrabold">{t("landing.ctaTitle")}</h2>
        <p className="text-(--color-text-dim) max-w-lg">{t("landing.ctaText")}</p>
        <Link to={`/${YEAR}`} className={PRIMARY_BTN}>
          {t("landing.openDashboard")} →
        </Link>
      </section>
    </div>
  );
}
