// Останнє коло й сектори (W12, L11): час кола, S1-S3 з кольорами
// (фіолетовий - найкращий у сесії: плашка + ⏱; зелений - особистий: напівжирний),
// смужка міні-секторів (segments_sector_*; у live може бути null - тоді лише
// S1-S3), speed trap I1/I2/ST і компактний список кіл пілота.
import { useTranslation } from "react-i18next";
import { formatLapTime, formatSectorTime, DASH } from "../../../live/format";
import { compoundMeta } from "../../../live/tyres";
import { compoundForLap, lapMiniSectors, lapPitFlag, timingKind } from "./helpers";

const LIST_LIMIT = 12;

/** Час з кольором і неколірною підказкою (§5.2). */
function Timed({ kind, children, className = "", title }) {
  if (kind === "session") {
    return (
      <span className={`tabular rounded px-1 bg-(--color-timing-purple-bg) text-white font-bold ${className}`} title={title}>
        {children}
      </span>
    );
  }
  if (kind === "personal") {
    return (
      <span className={`tabular text-(--color-timing-green) font-bold ${className}`} title={title}>
        {children}
      </span>
    );
  }
  return <span className={`tabular ${className}`}>{children}</span>;
}

// Міні-сектори: колір + (у палітрі для дальтоніків .live-cb) різна висота:
// фіолетовий 100 %, зелений 70 %, жовтий 40 % (§5.2). Немає даних - порожня рамка.
const MINI_CLASS = {
  purple: "bg-(--color-timing-purple) h-full",
  green: "bg-(--color-timing-green) h-full [.live-cb_&]:h-[70%]",
  yellow: "bg-(--color-timing-yellow) h-full [.live-cb_&]:h-[40%]",
  pit: "bg-(--color-pit-lane) h-full",
  none: "border border-(--color-line) h-full",
};

function MiniSectors({ minis, label }) {
  return (
    <div className="flex items-end gap-1 h-2" role="img" aria-label={label} title={label}>
      {minis.map((sector, k) => (
        <div key={k} className="flex items-end gap-px h-full" style={{ flex: `${Math.max(1, sector.length)} 1 0` }}>
          {sector.map((kind, i) => (
            <span key={i} className={`flex-1 rounded-[1px] ${MINI_CLASS[kind]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function sectorTitle(t, kind) {
  return kind === "session" ? t("live.focus.lap.sessionBest") : kind === "personal" ? t("live.focus.lap.personalBest") : undefined;
}

function LapList({ laps, stints, personalBest, sessionBest }) {
  const { t } = useTranslation();
  const rows = laps.slice(-LIST_LIMIT).reverse();
  return (
    <details className="group">
      <summary className="cursor-pointer select-none text-[11px] font-bold uppercase tracking-wider text-(--color-text-dim) hover:text-(--color-text) list-none flex items-center gap-1">
        <span className="inline-block transition-transform duration-100 group-open:rotate-90" aria-hidden="true">
          ›
        </span>
        {t("live.focus.lap.list", { count: laps.length })}
      </summary>
      <table className="w-full mt-1.5 text-[11px] tabular">
        <thead>
          <tr className="text-(--color-text-dim) text-left">
            <th className="font-normal py-0.5">{t("live.focus.lap.colLap")}</th>
            <th className="font-normal">{t("live.focus.lap.colTime")}</th>
            <th className="font-normal text-right">S1</th>
            <th className="font-normal text-right">S2</th>
            <th className="font-normal text-right">S3</th>
            <th className="font-normal text-center">{t("live.focus.lap.colTyre")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((lap) => {
            const pit = lapPitFlag(lap);
            const lapKind = timingKind(lap.lap_duration, personalBest?.lap, sessionBest?.lap?.time);
            const compound = compoundForLap(stints, lap.lap_number);
            return (
              <tr key={lap.lap_number} className={pit ? "text-(--color-text-dim)" : ""}>
                <td className="py-0.5">
                  {lap.lap_number}
                  {pit && (
                    <span className="ml-1 text-[9px] font-bold text-(--color-pit-lane)" title={pit === "in" ? t("live.focus.lap.pitIn") : t("live.focus.lap.pitOut")}>
                      {pit === "in" ? "IN" : "OUT"}
                    </span>
                  )}
                </td>
                <td>
                  <Timed kind={lapKind} title={sectorTitle(t, lapKind)}>
                    {lapKind === "session" ? "⏱ " : ""}
                    {formatLapTime(lap.lap_duration)}
                  </Timed>
                </td>
                {[0, 1, 2].map((k) => {
                  const v = lap[`duration_sector_${k + 1}`];
                  const kind = timingKind(v, personalBest?.sectors?.[k], sessionBest?.sectors?.[k]?.time);
                  return (
                    <td key={k} className="text-right">
                      <Timed kind={kind} title={sectorTitle(t, kind)}>
                        {formatSectorTime(v)}
                      </Timed>
                    </td>
                  );
                })}
                <td className="text-center font-bold">{compound ? compoundMeta(compound).letter : DASH}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

export default function LastLap({ detail }) {
  const { t } = useTranslation();
  const lap = detail?.lastLap;
  const pb = detail?.personalBest;
  const sb = detail?.sessionBest;
  if (!lap) {
    return (
      <div className="flex flex-col gap-1">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-dim)">{t("live.focus.lap.title")}</h4>
        <p className="text-xs text-(--color-text-dim)">{t("live.focus.lap.none")}</p>
      </div>
    );
  }
  const pit = lapPitFlag(lap);
  const lapKind = timingKind(lap.lap_duration, pb?.lap, sb?.lap?.time);
  const minis = lapMiniSectors(lap);
  const trap = (label, v) => (
    <span>
      {label} <b className="tabular font-semibold text-(--color-text)">{v ?? DASH}</b>
    </span>
  );
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-(--color-text-dim)">{t("live.focus.lap.title")}</h4>
        <span className="text-[11px] text-(--color-text-dim)">
          {t("live.focus.lap.lapN", { lap: lap.lap_number })}
          {pit && <span className="text-(--color-pit-lane) font-semibold"> · {pit === "in" ? t("live.focus.lap.pitIn") : t("live.focus.lap.pitOut")}</span>}
        </span>
      </div>
      <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-baseline gap-x-2">
        <Timed kind={lapKind} className="text-[17px] leading-tight" title={sectorTitle(t, lapKind) ?? t("live.focus.lap.lapTime")}>
          {lapKind === "session" ? "⏱ " : ""}
          {formatLapTime(lap.lap_duration)}
        </Timed>
        {[0, 1, 2].map((k) => {
          const v = lap[`duration_sector_${k + 1}`];
          const kind = timingKind(v, pb?.sectors?.[k], sb?.sectors?.[k]?.time);
          return (
            <span key={k} className="flex flex-col items-end">
              <span className="text-[10px] text-(--color-text-dim)">S{k + 1}</span>
              <Timed kind={kind} className="text-[13px]" title={sectorTitle(t, kind)}>
                {formatSectorTime(v)}
              </Timed>
            </span>
          );
        })}
      </div>
      {minis && <MiniSectors minis={minis} label={t("live.focus.lap.miniLegend")} />}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-(--color-text-dim)" title={t("live.focus.lap.traps")}>
        {trap(t("live.focus.lap.trapI1"), lap.i1_speed)}
        {trap(t("live.focus.lap.trapI2"), lap.i2_speed)}
        {trap(t("live.focus.lap.trapST"), lap.st_speed)}
        <span>{t("live.focus.telemetry.kmh")}</span>
      </div>
      {detail.laps.length > 1 && <LapList laps={detail.laps} stints={detail.stints} personalBest={pb} sessionBest={sb} />}
    </div>
  );
}
