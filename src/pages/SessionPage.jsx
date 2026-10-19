import { useMemo, useState } from "react";
import { useNavigate, useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useElapsed } from "../hooks/useElapsed";
import { classifySession, supportsCsvFastMode } from "../utils/format";
import { formatLapTime } from "../utils/time";
import { classifiedPositionLabel, teamHex, FALLBACK_SERIES_COLOR } from "../utils/constants";
import ResultsTable from "../components/results/ResultsTable";
import DriverCell from "../components/results/DriverCell";
import TeamBadge from "../components/results/TeamBadge";
import PositionDelta from "../components/results/PositionDelta";
import TyreBadge from "../components/results/TyreBadge";
import DriverMultiSelect from "../components/drivers/DriverMultiSelect";
import LapTimeChart from "../components/charts/LapTimeChart";
import PositionChart from "../components/charts/PositionChart";
import GridPositionScatter from "../components/charts/GridPositionScatter";
import PitStopTimeline from "../components/charts/PitStopTimeline";
import TrackEvolutionChart from "../components/charts/TrackEvolutionChart";
import SpeedTrapRanking from "../components/charts/SpeedTrapRanking";
import LapsTable from "../components/laps/LapsTable";
import WeatherCharts from "../components/charts/WeatherCharts";
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import Badge from "../components/common/Badge";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";

function buildColumns(category, year, round, session) {
  const driverCol = {
    key: "Abbreviation",
    label: "Пілот",
    render: (row) => (
      <DriverCell
        code={row.Abbreviation}
        headshotUrl={row.HeadshotUrl}
        teamColor={row.TeamColor}
        to={`/${year}/${round}/${session}/driver/${row.Abbreviation}`}
      />
    ),
  };
  const teamCol = {
    key: "TeamName",
    label: "Команда",
    render: (row) => <TeamBadge color={row.TeamColor} name={row.TeamName} />,
  };

  if (category === "qualifying") {
    return [
      { key: "Position", label: "Поз." },
      driverCol,
      teamCol,
      { key: "Q1", label: "Q1", render: (r) => formatLapTime(r.Q1) },
      { key: "Q2", label: "Q2", render: (r) => formatLapTime(r.Q2) },
      { key: "Q3", label: "Q3", render: (r) => formatLapTime(r.Q3) },
    ];
  }

  return [
    { key: "Position", label: "Поз." },
    {
      key: "ClassifiedPosition",
      label: "Кл.",
      render: (r) => classifiedPositionLabel(r.ClassifiedPosition),
    },
    driverCol,
    teamCol,
    { key: "GridPosition", label: "Старт" },
    {
      key: "delta",
      label: "Δ старт",
      render: (r) => <PositionDelta gridPosition={r.GridPosition} position={r.Position} />,
    },
    { key: "Laps", label: "Кола" },
    { key: "Time", label: "Час", render: (r) => formatLapTime(r.Time) },
    { key: "Points", label: "Очки" },
    { key: "Status", label: "Статус" },
  ];
}

// /api/csv/results — вужчий контракт (без TeamColor/HeadshotUrl/
// ClassifiedPosition), тому окремий, паралельний набір колонок, а не
// адаптація buildColumns.
function buildCsvColumns(category, year, round, session) {
  const driverCol = {
    key: "code",
    label: "Пілот",
    render: (r) => (
      <DriverCell code={r.code} to={`/${year}/${round}/${session}/driver/${r.code}`} />
    ),
  };
  const teamCol = { key: "team", label: "Команда" };

  if (category === "qualifying") {
    return [
      { key: "position", label: "Поз." },
      driverCol,
      teamCol,
      { key: "q1", label: "Q1", render: (r) => formatLapTime(r.q1) },
      { key: "q2", label: "Q2", render: (r) => formatLapTime(r.q2) },
      { key: "q3", label: "Q3", render: (r) => formatLapTime(r.q3) },
    ];
  }

  return [
    { key: "position_text", label: "Поз." },
    driverCol,
    teamCol,
    { key: "grid", label: "Старт" },
    { key: "laps", label: "Кола" },
    { key: "time_display", label: "Час" }, // вже готовий рядок з датасету — без переформатування
    {
      key: "fastest_lap_time",
      label: "Найкраще коло",
      render: (r) => (r.fastest_lap_time != null ? `${formatLapTime(r.fastest_lap_time)} (к.${r.fastest_lap})` : "—"),
    },
    { key: "points", label: "Очки" },
    { key: "status", label: "Статус" },
  ];
}

const pitStopColumns = [
  { key: "lap", label: "Коло" },
  { key: "code", label: "Пілот" },
  { key: "stop", label: "Стоп №" },
  { key: "duration", label: "Тривалість", render: (r) => `${r.duration.toFixed(3)}с` },
  { key: "time_of_day", label: "Час доби" },
];

function bestLapsSummary(laps) {
  const byDriver = new Map();
  for (const lap of laps) {
    if (lap.LapTime == null || lap.IsAccurate === false) continue;
    const current = byDriver.get(lap.Driver);
    if (!current || lap.LapTime < current.LapTime) byDriver.set(lap.Driver, lap);
  }
  return [...byDriver.values()]
    .sort((a, b) => a.LapTime - b.LapTime)
    .map((lap, i) => ({ ...lap, rank: i + 1 }));
}

export default function SessionPage() {
  const { year, round, session } = useParams();
  const { event, sessions } = useOutletContext();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = classifySession(session);
  const [tab, setTab] = useState(category === "practice" ? "laps" : "results");
  const [fastMode, setFastMode] = useState(false);
  const csvAvailable = supportsCsvFastMode(session);

  useSetBreadcrumb(
    [
      { label: year, to: `/${year}` },
      { label: event ? event.EventName : `Етап ${round}`, to: `/${year}/${round}` },
      { label: session },
    ],
    [year, round, session, event?.EventName]
  );

  const selected = useMemo(() => {
    const raw = searchParams.get("drivers");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  const toggleDriver = (code) => {
    const next = selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code];
    const params = new URLSearchParams(searchParams);
    if (next.length) params.set("drivers", next.join(","));
    else params.delete("drivers");
    setSearchParams(params, { replace: true });
  };

  const results = useApiQuery(
    () => api.getResultsForSession(year, round, session),
    [year, round, session],
    { enabled: tab === "results" && !fastMode }
  );
  const csvResults = useApiQuery(
    () => api.getCsvResults(year, round, session),
    [year, round, session],
    { enabled: tab === "results" && fastMode && csvAvailable }
  );
  // Скільки секунд основний (FastF1) запит результатів уже висить —
  // на ~20с пропонуємо перемкнутись на миттєвий CSV-режим самі, а не
  // мовчки чекати поруч зі спінером.
  const waitElapsed = useElapsed(tab === "results" && !fastMode && results.loading);
  const showFastModeSuggestion = csvAvailable && waitElapsed >= 20;

  const drivers = useApiQuery(() => api.getDrivers(year, round, session), [year, round, session]);
  // Один запит на всі кола сесії (без фільтра ?drivers=) — інакше вибір
  // пілотів для графіка/порівняння непомітно "зжер" би таблицю найкращих
  // кіл практики, звузивши її лише до обраних. Фільтрація — на фронті.
  const laps = useApiQuery(() => api.getLaps(year, round, session), [year, round, session], {
    enabled: tab === "laps" || tab === "weather" || category === "practice",
  });
  const weather = useApiQuery(() => api.getWeather(year, round, session), [year, round, session], {
    enabled: tab === "weather",
  });
  // /api/csv/pitstops не бере сесію — це завжди пітстопи гонки, тому
  // показуємо лише на вкладці самої гонки (не спринту, не кваліфікації).
  const pitStops = useApiQuery(() => api.getPitStops(year, round), [year, round], {
    enabled: tab === "results" && session === "R",
  });
  const fastestStop = useMemo(() => {
    if (!pitStops.data?.length) return null;
    return pitStops.data.reduce((min, p) => (p.duration < min.duration ? p : min));
  }, [pitStops.data]);
  // Ряди стрічки піт-стопів — у порядку фінішу (Position з /api/drivers),
  // щоб зверху був переможець, а не абетка.
  const pitStopOrder = useMemo(() => {
    return [...(drivers.data || [])]
      .sort((a, b) => (a.Position ?? 999) - (b.Position ?? 999))
      .map((d) => d.Abbreviation);
  }, [drivers.data]);

  // Старт→фініш для всього поля — лише в режимі FastF1 (звідти колір
  // команди; у CSV-режимі його нема).
  const gridPositionPoints = useMemo(() => {
    if (fastMode || !results.data) return [];
    return results.data.map((r) => ({
      code: r.Abbreviation,
      teamColor: r.TeamColor,
      grid: r.GridPosition,
      position: r.Position,
    }));
  }, [fastMode, results.data]);

  const driverColorByCode = useMemo(() => {
    const map = new Map();
    (drivers.data || []).forEach((d) => map.set(d.Abbreviation, d.TeamColor));
    return map;
  }, [drivers.data]);

  const sessionMeta = (sessions || []).find((s) => s.code === session);
  const columns = buildColumns(category, year, round, session);
  const csvColumns = buildCsvColumns(category, year, round, session);

  const tabs =
    category === "practice"
      ? [{ id: "laps", label: "Кола" }, { id: "weather", label: "Погода" }]
      : [
          { id: "results", label: "Результати" },
          { id: "laps", label: "Кола" },
          { id: "weather", label: "Погода" },
        ];

  const lapSeries = selected.map((code) => ({
    code,
    color: teamHex(driverColorByCode.get(code), FALLBACK_SERIES_COLOR),
    laps: (laps.data || []).filter((l) => l.Driver === code),
  }));

  // Усе поле одразу для "карти боротьби" — не гейтиться вибором пілотів,
  // на відміну від lapSeries вище. Пунктир напарникам по команді з
  // однаковим кольором, як і в порівнянні.
  const allDriversSeries = useMemo(() => {
    const codes = [...new Set((laps.data || []).map((l) => l.Driver))];
    const seenColors = new Set();
    return codes.map((code) => {
      const teamColor = driverColorByCode.get(code);
      const color = teamHex(teamColor, FALLBACK_SERIES_COLOR);
      const dash = seenColors.has(color);
      seenColors.add(color);
      return { code, color, dash, laps: (laps.data || []).filter((l) => l.Driver === code) };
    });
  }, [laps.data, driverColorByCode]);

  const summary = category === "practice" ? bestLapsSummary(laps.data || []) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase text-(--color-text-dim)">
          {sessionMeta?.name || session}
        </h3>
        <div className="flex gap-1 bg-(--color-surface) border border-(--color-line) rounded-md p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs uppercase tracking-wide rounded transition-colors ${
                tab === t.id
                  ? "bg-(--color-accent) text-white font-semibold"
                  : "text-(--color-text-dim) hover:text-(--color-text)"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "results" && (
        <div className="flex flex-col gap-3">
          {csvAvailable && (
            <div className="flex items-center gap-2.5">
              <div className="flex gap-1 bg-(--color-surface) border border-(--color-line) rounded-full p-1">
                {[
                  { id: false, label: "FastF1" },
                  { id: true, label: "CSV" },
                ].map((o) => (
                  <button
                    key={String(o.id)}
                    onClick={() => setFastMode(o.id)}
                    className={`px-3 py-1 text-xs uppercase tracking-wide rounded-full transition-colors ${
                      fastMode === o.id
                        ? "bg-(--color-accent) text-white font-semibold"
                        : "text-(--color-text-dim) hover:text-(--color-text)"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              {fastMode && <Badge tone="neutral">CSV — звужений набір полів</Badge>}
            </div>
          )}

          {!fastMode && showFastModeSuggestion && (
            <div className="border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-3 flex items-center justify-between gap-3" style={{ borderLeft: "3px solid var(--color-warn)" }}>
              <p className="text-sm text-(--color-text-dim)">
                Це триває довше за звичне — спробувати швидкий CSV-режим (менше полів, але миттєво)?
              </p>
              <button
                onClick={() => setFastMode(true)}
                className="shrink-0 text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md bg-(--color-warn) text-black"
              >
                Спробувати CSV
              </button>
            </div>
          )}

          {fastMode ? (
            <>
              <ErrorBanner message={csvResults.error} onRetry={csvResults.refetch} />
              {!csvResults.error && (
                <ResultsTable rows={csvResults.data || []} columns={csvColumns} emptyLabel="Результатів немає." />
              )}
            </>
          ) : (
            <>
              <ErrorBanner message={results.error} onRetry={results.refetch} />
              {results.loading ? (
                <Loader label={`Завантажуємо результати сесії ${sessionMeta?.name || session}…`} />
              ) : (
                !results.error && (
                  <ResultsTable rows={results.data || []} columns={columns} emptyLabel="Результатів немає." />
                )
              )}
            </>
          )}

          {category === "race" && gridPositionPoints.length > 0 && (
            <div>
              <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                Старт → Фініш
              </h4>
              <GridPositionScatter points={gridPositionPoints} />
            </div>
          )}

          {session === "R" && !pitStops.error && pitStops.data?.length > 0 && (
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim)">Піт-стопи</h4>
                {fastestStop && (
                  <Badge tone="good">
                    🏆 Найшвидший: {fastestStop.code} {fastestStop.duration.toFixed(3)}с
                  </Badge>
                )}
              </div>
              <ResultsTable rows={pitStops.data} columns={pitStopColumns} emptyLabel="Піт-стопів немає." />
              <div className="mt-3">
                <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                  Стрічка піт-стопів
                </h4>
                <PitStopTimeline pitStops={pitStops.data} order={pitStopOrder} />
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "laps" && (
        <div className="flex flex-col gap-4">
          <ErrorBanner
            message={laps.error || drivers.error}
            onRetry={() => {
              laps.refetch();
              drivers.refetch();
            }}
          />

          {laps.loading || drivers.loading ? (
            <Loader
              label={
                category === "practice"
                  ? `Завантажуємо кола сесії ${session}… для гонки/практики це можуть бути сотні рядків`
                  : `Завантажуємо кола та пілотів сесії ${session}…`
              }
            />
          ) : (
            !laps.error &&
            !drivers.error && (
              <>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    Позиція по колах
                  </h4>
                  <PositionChart series={allDriversSeries} />
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    Еволюція траси
                  </h4>
                  <TrackEvolutionChart laps={laps.data || []} />
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    Рейтинг спідтрапу (ST)
                  </h4>
                  <SpeedTrapRanking laps={laps.data || []} colorByCode={driverColorByCode} />
                </div>

                {category === "practice" && (
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                      Найкращі кола (за /api/laps — результати практики малоінформативні)
                    </h4>
                    <ResultsTable
                      rows={summary}
                      emptyLabel="Кіл ще немає."
                      columns={[
                        { key: "rank", label: "#" },
                        {
                          key: "Driver",
                          label: "Пілот",
                          render: (r) => (
                            <DriverCell code={r.Driver} to={`/${year}/${round}/${session}/driver/${r.Driver}`} />
                          ),
                        },
                        { key: "Team", label: "Команда" },
                        { key: "LapTime", label: "Найкраще коло", render: (r) => formatLapTime(r.LapTime) },
                        {
                          key: "Compound",
                          label: "Шина",
                          render: (r) => <TyreBadge compound={r.Compound} />,
                        },
                      ]}
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim)">
                      Оберіть пілотів (для графіка темпу й порівняння)
                    </h4>
                    <button
                      disabled={selected.length < 2}
                      onClick={() =>
                        navigate(`/${year}/${round}/${session}/compare?drivers=${selected.join(",")}`)
                      }
                      className="text-xs uppercase tracking-wide px-3 py-1.5 rounded bg-(--color-accent) text-white font-semibold disabled:opacity-30 disabled:cursor-not-allowed"
                      title={selected.length < 2 ? "Обери щонайменше 2 пілотів" : undefined}
                    >
                      Порівняти обраних →
                    </button>
                  </div>
                  <DriverMultiSelect drivers={drivers.data || []} selected={selected} onToggle={toggleDriver} />
                </div>

                {selected.length > 0 && (
                  <div>
                    <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                      Темп по колах
                    </h4>
                    <LapTimeChart series={lapSeries} />
                  </div>
                )}

                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">Усі кола</h4>
                  <LapsTable laps={selected.length ? lapSeries.flatMap((s) => s.laps) : laps.data || []} showDriver />
                </div>
              </>
            )
          )}
        </div>
      )}

      {tab === "weather" && (
        <>
          <ErrorBanner message={weather.error} onRetry={weather.refetch} />
          {weather.loading ? (
            <Loader label={`Завантажуємо погоду сесії ${session}…`} />
          ) : (
            !weather.error && <WeatherCharts points={weather.data || []} laps={laps.data} />
          )}
        </>
      )}
    </div>
  );
}
