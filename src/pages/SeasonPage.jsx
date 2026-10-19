import { lazy, Suspense, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { isEventCompleted } from "../utils/format";
import { fetchCircuits } from "../utils/circuits";
import RaceList from "../components/season/RaceList";
// Вкладки чемпіонату — окремим чанком: їхні графіки тягнуть Recharts, а
// стартовий екран (календар) без нього обходиться.
const DriverStandings = lazy(() => import("../components/standings/DriverStandings"));
const TeamStandings = lazy(() => import("../components/standings/TeamStandings"));
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import SeasonNow from "../components/season/SeasonNow";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { t } from "../i18n";

const TABS = [
  { id: "calendar", labelKey: "season.tabCalendar" },
  { id: "drivers", labelKey: "season.tabDrivers" },
  { id: "teams", labelKey: "season.tabTeams" },
];

export default function SeasonPage() {
  const { year } = useParams();
  const navigate = useNavigate();
  const numericYear = Number(year);
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.some((t) => t.id === searchParams.get("tab")) ? searchParams.get("tab") : "calendar";
  const tabQuery = tab === "calendar" ? "" : `?tab=${tab}`;

  useSetBreadcrumb([{ label: t("season.titleYear", { year }) }], [year]);

  // /api/seasons — миттєвий CSV-список (сягає 1950-х), не потребує
  // Loader; найстаріші роки можуть не мати даних у /api/races (FastF1
  // покриває від 2018) — це очікуваний 404, не помилка застосунку.
  const { data: seasons } = useApiQuery(() => api.getSeasons(), []);
  const sortedSeasons = useMemo(() => [...(seasons || [])].sort((a, b) => b - a), [seasons]);

  const { data: races, loading, error, refetch } = useApiQuery(
    () => api.getRaces(numericYear),
    [numericYear],
    { enabled: Number.isFinite(numericYear) }
  );

  // Контури трас — статичний файл, не чекаємо на нього з календарем:
  // мініатюри просто зʼявляться, щойно він підвантажиться.
  const { data: circuits } = useApiQuery(() => fetchCircuits(numericYear), [numericYear]);

  // Чемпіонат — CSV на бекенді, миттєво. Потрібен і календарю (переможці
  // етапів, лідери в блоці "Зараз у сезоні"), і вкладкам "Пілоти"/"Команди".
  const progress = useApiQuery(() => api.getSeasonProgress(numericYear), [numericYear], {
    enabled: Number.isFinite(numericYear),
  });

  const winners = useMemo(
    () => new Map((progress.data?.rounds || []).filter((r) => r.winner).map((r) => [r.round, r.winner])),
    [progress.data]
  );
  // Наступний етап — перший незавершений; останній — найпізніший завершений.
  const { nextRace, lastRace } = useMemo(() => {
    const list = races || [];
    const completed = list.filter(isEventCompleted);
    return { nextRace: list.find((r) => !isEventCompleted(r)), lastRace: completed[completed.length - 1] };
  }, [races]);

  const filtered = useMemo(() => {
    const list = races || [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      [r.EventName, r.Location, r.Country].some((v) => v && v.toLowerCase().includes(q))
    );
  }, [races, query]);

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold uppercase tracking-wide">{t("season.title")}</h1>
        <div className="flex items-center gap-2">
          <select
            value={year}
            aria-label={t("season.title")}
            onChange={(e) => navigate(`/${e.target.value}${tabQuery}`)}
            className="bg-(--color-surface) border border-(--color-line) rounded-md px-2.5 py-1 text-xl font-bold font-mono-data focus:outline-none focus:border-(--color-accent)"
          >
            {(sortedSeasons.length ? sortedSeasons : [numericYear]).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="flex gap-1 self-start bg-(--color-surface) border border-(--color-line) rounded-full p-1" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setSearchParams(item.id === "calendar" ? {} : { tab: item.id })}
            className={`px-3.5 py-1.5 text-xs uppercase tracking-wide rounded-full transition-colors ${
              tab === item.id
                ? "bg-(--color-accent) text-white font-semibold"
                : "text-(--color-text-dim) hover:text-(--color-text) hover:bg-(--color-surface-2)"
            }`}
          >
            {t(item.labelKey)}
          </button>
        ))}
      </nav>

      {tab !== "calendar" && (
        <>
          <ErrorBanner message={progress.error} onRetry={progress.refetch} />
          {progress.loading && <Loader label={t("season.loadingStandings", { year })} />}
          {progress.data && !progress.data.drivers.length && (
            <p className="text-sm text-(--color-text-dim)">{t("season.noRacesYet")}</p>
          )}
          {progress.data?.drivers.length > 0 && (
            <Suspense fallback={<Loader label={t("common.loadingPage")} />}>
              {tab === "drivers" ? (
                <DriverStandings progress={progress.data} year={year} />
              ) : (
                <TeamStandings progress={progress.data} year={year} />
              )}
            </Suspense>
          )}
        </>
      )}

      {tab === "calendar" && <ErrorBanner message={error} onRetry={refetch} />}

      {tab !== "calendar" ? null : loading ? (
        <Loader label={t("season.loadingCalendar", { year })} />
      ) : (
        !error && (
          // Десктоп: календар + бічна колонка "Зараз у сезоні" (липка). Телефон:
          // блок над календарем — головне видно без прокручування.
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] items-start">
            <aside className="flex flex-col gap-4 min-w-0 lg:order-2 lg:sticky lg:top-20">
              <SeasonNow
                year={year}
                races={races || []}
                nextRace={nextRace}
                lastRace={lastRace}
                progress={progress.data}
                circuits={circuits}
              />
            </aside>

            <section className="flex flex-col gap-3 min-w-0 lg:order-1" aria-label={t("season.tabCalendar")}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("season.search")}
                aria-label={t("season.searchLabel")}
                className="bg-(--color-surface) border border-(--color-line) rounded-md px-3.5 py-2.5 text-sm placeholder:text-(--color-text-dim) focus:outline-none focus:border-(--color-accent)"
              />
              <RaceList
                year={year}
                races={filtered}
                circuits={circuits || {}}
                winners={winners}
                nextRound={nextRace?.RoundNumber}
              />
            </section>
          </div>
        )
      )}
    </div>
  );
}
