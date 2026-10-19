import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { formatLapTime, formatSector, formatDelta } from "../utils/time";
import { teamHex, FALLBACK_SERIES_COLOR } from "../utils/constants";
import TyreBadge from "../components/results/TyreBadge";
import LapTimeChart from "../components/charts/LapTimeChart";
import DeltaChart from "../components/charts/DeltaChart";
import TyreStintTimeline, { TyreLegend } from "../components/charts/TyreStintTimeline";
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import { t } from "../i18n";

const SLOT_LETTERS = "ABCDEFGH";
const MAX_SLOTS = 6;

// /api/compare не повертає готові stints (на відміну від /api/driver) —
// відновлюємо їх групуванням laps за Stint.
function deriveStints(laps) {
  const byStint = new Map();
  for (const lap of laps) {
    if (lap.Stint == null) continue;
    if (!byStint.has(lap.Stint)) {
      byStint.set(lap.Stint, { stint: lap.Stint, compound: lap.Compound, first_lap: lap.LapNumber, last_lap: lap.LapNumber });
    }
    const s = byStint.get(lap.Stint);
    s.first_lap = Math.min(s.first_lap, lap.LapNumber);
    s.last_lap = Math.max(s.last_lap, lap.LapNumber);
  }
  return [...byStint.values()].sort((a, b) => a.stint - b.stint);
}

function FastestLapCard({ code, color, fastest }) {
  return (
    <div className="border border-(--color-line) bg-(--color-surface-2) rounded-md overflow-hidden" style={{ borderTop: `3px solid ${color}` }}>
      <p className="text-[11px] uppercase tracking-widest text-(--color-text-dim) font-bold px-4 pt-3">
        {t("compare.fastestLap", { code })}
      </p>
      {fastest ? (
        <dl className="px-4 pb-3.5 pt-2 text-sm">
          {[
            [t("compare.lapTime"), formatLapTime(fastest.LapTime), true],
            [t("compare.sector", { n: 1 }), formatSector(fastest.Sector1Time)],
            [t("compare.sector", { n: 2 }), formatSector(fastest.Sector2Time)],
            [t("compare.sector", { n: 3 }), formatSector(fastest.Sector3Time)],
          ].map(([label, value, big]) => (
            <div key={label} className="flex items-center justify-between py-1 border-t border-(--color-line) first:border-t-0">
              <dt className="text-(--color-text-dim)">{label}</dt>
              <dd className={`font-mono-data ${big ? "font-bold text-base" : ""}`}>{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between py-1 border-t border-(--color-line)">
            <dt className="text-(--color-text-dim)">{t("laps.tyre")}</dt>
            <dd><TyreBadge compound={fastest.Compound} /></dd>
          </div>
          <div className="flex items-center justify-between py-1 border-t border-(--color-line)">
            <dt className="text-(--color-text-dim)">{t("compare.lapNumber")}</dt>
            <dd className="font-mono-data">{fastest.LapNumber ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-(--color-text-dim) px-4 pb-3.5 pt-2">{t("common.noData")}</p>
      )}
    </div>
  );
}

export default function ComparePage() {
  const { year, round, session } = useParams();
  const { event } = useOutletContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const selected = useMemo(() => {
    const raw = searchParams.get("drivers");
    return raw ? raw.split(",").filter(Boolean) : [];
  }, [searchParams]);

  useSetBreadcrumb(
    [
      { label: year, to: `/${year}` },
      { label: event ? event.EventName : t("chart.roundN", { round }), to: `/${year}/${round}` },
      { label: session, to: `/${year}/${round}/${session}` },
      { label: t("compare.crumb") },
    ],
    [year, round, session, event?.EventName]
  );

  const [slotCount, setSlotCount] = useState(Math.max(selected.length, 2));
  useEffect(() => {
    setSlotCount((n) => Math.max(n, selected.length, 2));
  }, [selected.length]);

  const drivers = useApiQuery(() => api.getDrivers(year, round, session), [year, round, session]);
  const driverInfoByCode = useMemo(() => {
    const map = new Map();
    (drivers.data || []).forEach((d) => map.set(d.Abbreviation, d));
    return map;
  }, [drivers.data]);

  const setSlot = (index, code) => {
    const next = [...selected];
    if (code) next[index] = code;
    else next.splice(index, 1);
    const filtered = next.filter(Boolean);
    const params = new URLSearchParams(searchParams);
    if (filtered.length) params.set("drivers", filtered.join(","));
    else params.delete("drivers");
    setSearchParams(params, { replace: true });
  };

  const removeSlot = (index) => {
    setSlot(index, null);
    setSlotCount((n) => Math.max(2, n - 1));
  };

  const compare = useApiQuery(
    () => api.getCompare(year, round, session, selected),
    [year, round, session, selected.join(",")],
    { enabled: selected.length >= 2 }
  );

  // Кольори команд можуть збігатись у напарників по команді — додаємо
  // пунктир другому пілоту тієї ж команди, щоб лінії не зливались.
  const series = useMemo(() => {
    if (!compare.data) return [];
    const seenColors = new Set();
    return selected.map((code) => {
      const info = driverInfoByCode.get(code);
      const color = teamHex(info?.TeamColor, FALLBACK_SERIES_COLOR);
      const dash = seenColors.has(color);
      seenColors.add(color);
      return { code, color, dash, laps: compare.data[code]?.laps || [] };
    });
  }, [compare.data, selected, driverInfoByCode]);

  const reference = series[0];
  const referenceFastest = reference && compare.data?.[reference.code]?.fastest_lap;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-bold uppercase mb-3">{t("compare.title")}</h2>
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: slotCount }).map((_, i) => {
            const code = selected[i] || "";
            const info = driverInfoByCode.get(code);
            const color = teamHex(info?.TeamColor, "var(--color-line)");
            const takenElsewhere = new Set(selected.filter((_, j) => j !== i));
            return (
              <div
                key={i}
                className="border border-(--color-line) bg-(--color-surface-2) rounded-md p-3.5 flex flex-col gap-2 w-64"
                style={{ borderTop: `3px solid ${color}` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim) font-bold">
                    Driver {SLOT_LETTERS[i] || i + 1}
                  </span>
                  {slotCount > 2 && (
                    <button
                      onClick={() => removeSlot(i)}
                      aria-label={t("compare.removeSlot", { slot: SLOT_LETTERS[i] })}
                      className="text-(--color-text-dim) hover:text-(--color-danger) text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={code}
                  onChange={(e) => setSlot(i, e.target.value)}
                  className="bg-(--color-surface) border border-(--color-line) rounded-md px-2.5 py-2 text-sm focus:outline-none focus:border-(--color-accent)"
                >
                  <option value="">{t("compare.pickDriver")}</option>
                  {(drivers.data || [])
                    .filter((d) => d.Abbreviation === code || !takenElsewhere.has(d.Abbreviation))
                    .map((d) => (
                      <option key={d.Abbreviation} value={d.Abbreviation}>
                        {d.Abbreviation} — {d.TeamName}
                      </option>
                    ))}
                </select>
                {info && (
                  <p className="text-xs text-(--color-text-dim) flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                    <span className="font-mono-data font-semibold text-(--color-text)">{info.Abbreviation}</span>
                    #{info.DriverNumber} · {info.TeamName}
                  </p>
                )}
              </div>
            );
          })}

          {slotCount < MAX_SLOTS && (
            <button
              onClick={() => setSlotCount((n) => n + 1)}
              className="w-64 border border-dashed border-(--color-line) rounded-md p-3.5 flex items-center justify-center text-sm text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-accent) transition-colors"
            >
              + Add driver
            </button>
          )}
        </div>
      </div>

      {selected.length < 2 && (
        <p className="text-sm text-(--color-text-dim) border border-(--color-line) rounded-md px-4 py-3">
          {t("compare.pickTwo")}
        </p>
      )}

      <ErrorBanner
        message={drivers.error || compare.error}
        onRetry={() => {
          drivers.refetch();
          compare.refetch();
        }}
      />

      {selected.length >= 2 && (
        <>
          {compare.loading ? (
            <Loader label={t("compare.loading", { drivers: selected.join(", ") })} />
          ) : (
            !compare.error && (
              <>
                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    {t("compare.lapTimes")}
                  </h4>
                  <LapTimeChart series={series} />
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    {t("compare.gap", { code: reference?.code })}
                  </h4>
                  <DeltaChart series={series} />
                </div>

                {referenceFastest && (
                  <div className="flex flex-col gap-2.5">
                    {series.slice(1).map((s) => {
                      const fastest = compare.data?.[s.code]?.fastest_lap;
                      if (!fastest) return null;
                      const delta = fastest.LapTime - referenceFastest.LapTime;
                      const faster = delta < 0;
                      return (
                        <div key={s.code} className="border border-(--color-line) bg-(--color-surface-2) rounded-md px-5 py-4">
                          <p className="text-[11px] uppercase tracking-widest text-(--color-text-dim) font-bold mb-1">
                            {t("compare.bestLapDelta")}
                          </p>
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <span
                              className="font-mono-data text-3xl font-extrabold"
                              style={{ color: faster ? "var(--color-good)" : "var(--color-danger)" }}
                            >
                              {formatDelta(delta)}s
                            </span>
                            <span className="text-sm text-(--color-text-dim)">
                              <b style={{ color: s.color }}>{s.code}</b> {faster ? "faster than" : "slower than"}{" "}
                              <b style={{ color: reference.color }}>{reference.code}</b>
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    {t("compare.fastestLaps")}
                  </h4>
                  <div className="grid grid-cols-1 gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(15rem, 1fr))` }}>
                    {series.map((s) => (
                      <FastestLapCard
                        key={s.code}
                        code={s.code}
                        color={s.color}
                        fastest={compare.data?.[s.code]?.fastest_lap}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
                    {t("compare.strategies")}
                  </h4>
                  <TyreStintTimeline
                    rows={series.map((s) => ({ label: s.code, stints: deriveStints(s.laps) }))}
                  />
                  <div className="mt-2">
                    <TyreLegend />
                  </div>
                </div>
              </>
            )
          )}
        </>
      )}
    </div>
  );
}
