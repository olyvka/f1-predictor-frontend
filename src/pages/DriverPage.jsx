import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { formatLapTime } from "../utils/time";
import { classifiedPositionLabel, nationalityLabel, teamHex } from "../utils/constants";
import { isFuture } from "../utils/format";
import TyreStintTimeline, { TyreLegend } from "../components/charts/TyreStintTimeline";
import LapTimeChart from "../components/charts/LapTimeChart";
import TyreDegradationChart from "../components/charts/TyreDegradationChart";
import SectorTrendChart from "../components/charts/SectorTrendChart";
import StintBoxPlot from "../components/charts/StintBoxPlot";
import SpeedTrapChart from "../components/charts/SpeedTrapChart";
import LapsTable from "../components/laps/LapsTable";
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import StatTile from "../components/common/StatTile";
import EventContext from "../components/driver/EventContext";
import RaceVsField from "../components/driver/RaceVsField";
import { t } from "../i18n";

export default function DriverPage() {
  const { year, round, session, driverCode } = useParams();
  const navigate = useNavigate();
  const { event } = useOutletContext();

  const { data, loading, error, refetch } = useApiQuery(
    () => api.getDriver(year, round, session, driverCode),
    [year, round, session, driverCode]
  );
  const { data: sessions } = useApiQuery(() => api.getSessions(year, round), [year, round]);
  // /api/csv/pitstops не бере сесію (завжди пітстопи гонки) — тягнемо
  // лише на сторінці самої гонки, щоб домішати точну тривалість стопу в
  // графік темпу (FastF1 дає тільки коли був стоп, не скільки тривав).
  const { data: pitStops } = useApiQuery(() => api.getPitStops(year, round), [year, round], {
    enabled: session === "R",
  });

  useSetBreadcrumb(
    [
      { label: year, to: `/${year}` },
      { label: event ? event.EventName : t("chart.roundN", { round }), to: `/${year}/${round}` },
      { label: session, to: `/${year}/${round}/${session}` },
      { label: driverCode },
    ],
    [year, round, session, driverCode, event?.EventName]
  );

  // Хедер пілота (фото/імʼя/команда/номер/країна) не залежить від сесії й
  // не має "блимати" при перемиканні сесій — тримаємо останню успішну
  // копію окремо від сесійно-залежного `data`, який очищується на помилку
  // (напр. пілот відсутній саме в цій сесії).
  const [pinnedDriver, setPinnedDriver] = useState(null);
  useEffect(() => {
    if (data?.driver) setPinnedDriver(data.driver);
  }, [data]);

  // Домішуємо точну тривалість піт-стопу (з CSV) в об'єкт кола перед
  // передачею в графік темпу — FastF1 сам дає лише коли був стоп, не
  // скільки тривав. useMemo мусить стояти до ранніх return'ів нижче
  // (правила хуків), тому на цьому кроці пілот ще може бути null.
  const laps = data?.laps;
  const lapsWithPitDuration = useMemo(() => {
    if (!laps || !pitStops?.length || !pinnedDriver) return laps || [];
    const durationByLap = new Map(
      pitStops.filter((p) => p.code === pinnedDriver.Abbreviation).map((p) => [p.lap, p.duration])
    );
    if (!durationByLap.size) return laps;
    return laps.map((l) =>
      durationByLap.has(l.LapNumber) ? { ...l, PitDuration: durationByLap.get(l.LapNumber) } : l
    );
  }, [laps, pitStops, pinnedDriver]);

  // Контекст етапу (CSV) — за driverRef датасету; FastF1 віддає його в DriverId.
  const driverRef = pinnedDriver?.DriverId;
  const { data: eventCtx } = useApiQuery(() => api.getDriverEvent(year, round, driverRef), [year, round, driverRef], {
    enabled: !!driverRef,
  });
  // Кола всього поля — лише для гонки/спринту: темп відносно поля й позиції по колах.
  const isRace = session === "R" || session === "S";
  const { data: allLaps } = useApiQuery(() => api.getLaps(year, round, session), [year, round, session], {
    enabled: isRace,
  });

  if (!pinnedDriver && loading) return <Loader label={t("driverPage.loading", { code: driverCode })} />;
  if (!pinnedDriver && error) return <ErrorBanner message={error} onRetry={refetch} />;
  if (!pinnedDriver) return null;

  const teamColor = teamHex(pinnedDriver.TeamColor);
  const { result, stints, fastest_lap: fastestLap } = data || {};
  // Для гонок до 2023 (CSV) немає шин, секторів і швидкостей — порожні
  // графіки не показуємо.
  const lapList = laps || [];
  const hasCompound = lapList.some((l) => l.Compound);
  const hasSectors = lapList.some((l) => l.Sector2Time != null);
  const hasSpeeds = lapList.some((l) => l.SpeedST != null || l.SpeedI1 != null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-4" style={{ borderLeft: `4px solid ${teamColor}` }}>
          {pinnedDriver.HeadshotUrl ? (
            <img
              src={pinnedDriver.HeadshotUrl}
              alt=""
              className="w-16 h-16 rounded-full object-cover bg-(--color-surface) ml-4"
              onError={(e) => (e.currentTarget.style.visibility = "hidden")}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-(--color-surface) ml-4" />
          )}
          <div>
            <h2 className="text-xl font-bold uppercase">
              {driverRef ? (
                <Link to={`/${year}/drivers/${driverRef}`} className="hover:text-(--color-accent) transition-colors">
                  {pinnedDriver.FullName}
                </Link>
              ) : (
                pinnedDriver.FullName
              )}{" "}
              <span className="text-(--color-text-dim)">#{pinnedDriver.DriverNumber}</span>
            </h2>
            <p className="text-sm text-(--color-text-dim)">
              {/* FastF1 віддає CountryCode порожнім — країну беремо з датасету (контекст етапу). */}
              {[pinnedDriver.TeamName, pinnedDriver.CountryCode || nationalityLabel(eventCtx?.nationality)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <Link
          to={`/${year}/${round}/${session}/compare?drivers=${pinnedDriver.Abbreviation}`}
          className="text-xs uppercase tracking-wide font-semibold px-3.5 py-2 rounded-md border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-accent) transition-colors"
        >
          {t("driverPage.compare")} →
        </Link>
      </div>

      {/* Перемикач сесій етапу — той самий пілот, інша сесія, без виходу зі сторінки. */}
      <div className="flex flex-wrap gap-1 bg-(--color-surface) border border-(--color-line) rounded-full p-1 w-fit">
        {(sessions || []).map((s) => {
          const future = isFuture(s.date);
          const active = s.code === session;
          return (
            <button
              key={s.code}
              disabled={future}
              onClick={() => navigate(`/${year}/${round}/${s.code}/driver/${driverCode}`)}
              title={future ? t("session.notYet") : undefined}
              className={`px-3 py-1.5 text-xs uppercase tracking-wide rounded-full transition-colors ${
                future
                  ? "text-(--color-text-dim)/40 cursor-not-allowed"
                  : active
                  ? "bg-(--color-accent) text-white font-semibold"
                  : "text-(--color-text-dim) hover:text-(--color-text) hover:bg-(--color-surface-2)"
              }`}
            >
              {s.code}
            </button>
          );
        })}
      </div>

      {eventCtx && <EventContext ctx={eventCtx} year={year} driver={pinnedDriver} />}

      {error && <ErrorBanner message={error} onRetry={refetch} />}

      {loading && (
        <p className="text-xs text-(--color-text-dim) font-mono-data">{t("driverPage.updating", { session })}</p>
      )}

      {!error && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label={t("driverPage.position")} value={result?.Position ?? "—"} />
            <StatTile label={t("driverPage.classified")} value={classifiedPositionLabel(result?.ClassifiedPosition)} />
            <StatTile label={t("standingsTable.points")} value={result?.Points ?? "—"} />
            <StatTile label={t("driverPage.fastestLap")} value={formatLapTime(fastestLap?.LapTime)} accent />
          </div>

          {isRace && allLaps?.length > 0 && (
            <RaceVsField
              allLaps={allLaps}
              code={pinnedDriver.Abbreviation}
              mateCode={eventCtx?.teammate?.code}
              teamColor={pinnedDriver.TeamColor}
              pitStops={pitStops}
            />
          )}

          {stints?.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                {t("driverPage.tyreStrategy")}
              </h3>
              <TyreStintTimeline
                rows={[{ label: pinnedDriver.Abbreviation, stints }]}
                totalLaps={Math.max(...stints.map((s) => s.last_lap || 0), 1)}
              />
              <div className="mt-2">
                <TyreLegend />
              </div>
            </div>
          )}

          {hasCompound && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                {t("driverPage.degradation")}
              </h3>
              <TyreDegradationChart laps={lapList} />
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">{t("driverPage.pace")}</h3>
            <LapTimeChart series={[{ code: pinnedDriver.Abbreviation, color: teamColor, laps: lapsWithPitDuration }]} />
          </div>

          {hasSectors && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">{t("driverPage.sectors")}</h3>
              <SectorTrendChart laps={lapList} />
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
              {t("driverPage.stintSpread")}
            </h3>
            <StintBoxPlot laps={laps || []} />
          </div>

          {hasSpeeds && (
            <div>
              <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                {t("driverPage.speedTraps")}
              </h3>
              <SpeedTrapChart laps={lapList} color={teamColor} />
            </div>
          )}

          <div>
            <h3 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">{t("driverPage.allLaps")}</h3>
            <LapsTable laps={laps || []} />
          </div>
        </>
      )}
    </div>
  );
}
