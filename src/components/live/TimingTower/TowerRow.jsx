// Один рядок timing tower. Клітинки визначаються списком колонок (logic.columnsFor).
// Числа - tabular, null → «—»; колір таймінгу завжди з неколірною підказкою
// (плашка/⏱ для фіолетового, напівжирний для зеленого, курсив для піт-кола).
import { memo } from "react";
import { formatLapTime, formatSectorTime, DASH } from "../../../live/format";
import TyreBadge from "./TyreBadge";
import { bestLapKind, lastLapKind, pitSummary, qualiCompactCell, qualiDeltaCell, raceGapCell, rowChips, sectorKind } from "./logic";

const Dash = () => <span className="lt-dash">{DASH}</span>;

function StaleIcon() {
  return (
    <svg className="lt-stale-icon" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 3v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function TimeCell({ value, kind, t, glow, icon = false }) {
  if (kind === "none") return <Dash />;
  const title =
    kind === "session" ? t("live.tower.lap.sessionBest") : kind === "personal" ? t("live.tower.lap.personalBest") : kind === "pit" ? t("live.tower.lap.pit") : undefined;
  return (
    <span className="lt-time" data-kind={kind} title={title} data-glow={glow ? "" : undefined}>
      <span>
        {kind === "session" && icon && <span aria-hidden="true">⏱</span>}
        {formatLapTime(value)}
      </span>
      {title && <span className="lt-sr"> ({title})</span>}
    </span>
  );
}

function pitTitle(pits, t) {
  const list = pitSummary(pits);
  if (!list.length) return t("live.tower.pits.none");
  const lines = list.map((p) =>
    t("live.tower.pits.line", {
      lap: p.lap ?? DASH,
      lane: p.lane != null ? t("live.tower.pits.seconds", { value: p.lane.toFixed(1) }) : DASH,
      stop: p.stop != null ? t("live.tower.pits.seconds", { value: p.stop.toFixed(1) }) : DASH,
    })
  );
  return [t("live.tower.pits.title", { count: list.length }), ...lines].join("\n");
}

function TowerRow({
  row,
  columns,
  t,
  isRace,
  gapMode,
  refRow,
  digits,
  selected,
  rival,
  tabbable,
  arrow,
  elim,
  elimFirst,
  elimLabel,
  stale,
  bestSectors,
  personalSectors,
  prediction,
  predStatus,
  hideChips,
  radioNew = 0,
}) {
  const d = row.driver;
  const chips = hideChips ? [] : rowChips(row, { isRace });
  const cells = columns.map((c) => {
    switch (c) {
      case "pos":
        return (
          <td key={c} className="lt-pos tabular">
            {row.position ?? <Dash />}
            {elim && <span className="lt-sr"> ({elimLabel})</span>}
          </td>
        );
      case "chg": {
        const dir = arrow ? (arrow.delta > 0 ? "up" : "down") : null;
        // Без свіжої зміни - приглушена різниця з місцем на старті (гонка/спринт).
        const fromGrid = !arrow && isRace && row.grid != null && row.position != null ? row.grid - row.position : 0;
        return (
          <td key={c} className="lt-chg tabular" data-dir={dir || (fromGrid ? "grid" : undefined)}>
            {arrow ? (
              <span aria-label={t(dir === "up" ? "live.tower.a11y.up" : "live.tower.a11y.down", { count: Math.abs(arrow.delta) })}>
                {dir === "up" ? "▲" : "▼"}
                {Math.abs(arrow.delta)}
              </span>
            ) : fromGrid ? (
              <span title={t("live.tower.fromGrid", { grid: row.grid })}>
                {fromGrid > 0 ? "▲" : "▼"}
                {Math.abs(fromGrid)}
              </span>
            ) : null}
          </td>
        );
      }
      case "driver":
        return (
          <td key={c} className="lt-driver">
            <span className="lt-drv">
              <span className="lt-drv-main">
                <i className="lt-stripe" style={{ background: d?.color || "var(--color-tyre-unknown)" }} aria-hidden="true" />
                <b className="lt-tla">{d?.acronym || row.driverNumber}</b>
                <small className="lt-num tabular">{row.driverNumber}</small>
                {isRace && row.hasSessionBest && (
                  <span className="lt-fastest" title={t("live.tower.lap.sessionBest")} aria-label={t("live.tower.lap.sessionBest")}>
                    ⏱
                  </span>
                )}
                {radioNew > 0 && (
                  <span className="lt-radio" title={t("live.radio.towerChip", { count: radioNew })} aria-label={t("live.radio.towerChip", { count: radioNew })}>
                    <svg viewBox="0 0 12 12" aria-hidden="true">
                      <rect x="4" y="1" width="4" height="6.5" rx="2" fill="currentColor" />
                      <path d="M2.5 6a3.5 3.5 0 0 0 7 0M6 9.5V11" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                    </svg>
                    {radioNew > 1 && <span className="tabular">{radioNew}</span>}
                  </span>
                )}
              </span>
              {chips.length > 0 && (
                <span className="lt-chips">
                  {chips.map((ch) => {
                    const full = t(`live.tower.chip.${ch.key}Full`);
                    const title = ch.message ? `${full}: ${ch.message}` : full;
                    return (
                      <span key={ch.key} className="lt-chip" data-kind={ch.key} title={title} aria-label={title}>
                        {t(`live.tower.chip.${ch.key}`)}
                      </span>
                    );
                  })}
                </span>
              )}
            </span>
          </td>
        );
      case "gap": {
        const g = raceGapCell(row, { mode: gapMode, refRow, t, digits });
        const showStale = stale && (g.kind === "value" || g.kind === "laps");
        return (
          <td key={c} className={`tabular ${showStale ? "lt-stale" : ""}`} title={showStale ? t("live.tower.gap.stale") : undefined}>
            {showStale && <StaleIcon />}
            {g.kind === "none" ? <Dash /> : <span className={g.kind === "leader" || g.kind === "ref" ? "lt-dim" : undefined}>{g.text}</span>}
          </td>
        );
      }
      case "qgap": {
        const g = qualiCompactCell(row, { t, digits });
        return (
          <td key={c} className="tabular">
            {g.kind === "none" ? <Dash /> : <span className={g.kind === "leader" ? "lt-dim" : undefined}>{g.text}</span>}
          </td>
        );
      }
      case "delta": {
        const g = qualiDeltaCell(row, { t, digits });
        return (
          <td key={c} className="tabular">
            {g.kind === "none" ? <Dash /> : <span className={g.kind === "leader" ? "lt-dim" : undefined}>{g.text}</span>}
          </td>
        );
      }
      case "last":
        return (
          <td key={c} className="tabular">
            <TimeCell value={row.lastLapTime} kind={lastLapKind(row)} t={t} glow />
          </td>
        );
      case "best":
        return (
          <td key={c} className="tabular">
            <TimeCell value={row.bestLapTime} kind={bestLapKind(row)} t={t} glow={!isRace} icon />
          </td>
        );
      case "s1":
      case "s2":
      case "s3": {
        const k = Number(c[1]) - 1;
        const v = row.lastLap?.[`duration_sector_${k + 1}`];
        const kind = sectorKind(v, k, bestSectors, personalSectors);
        const title = kind === "session" ? t("live.tower.sector.session") : kind === "personal" ? t("live.tower.sector.personal") : undefined;
        return (
          <td key={c} className="tabular lt-sector">
            {kind === "none" ? (
              <Dash />
            ) : (
              <span className="lt-time" data-kind={kind} title={title}>
                <span>{formatSectorTime(v)}</span>
                {title && <span className="lt-sr"> ({title})</span>}
              </span>
            )}
          </td>
        );
      }
      case "tyre":
        return (
          <td key={c}>
            {row.compound || row.stint ? <TyreBadge compound={row.compound} age={row.tyreAge} used={row.usedSet} /> : <Dash />}
          </td>
        );
      case "pit":
        return (
          <td key={c} className="tabular lt-dim" title={pitTitle(row.pits, t)}>
            {row.pitCount || <Dash />}
          </td>
        );
      case "pred": {
        if (predStatus === "loading") {
          return (
            <td key={c}>
              <span className="lt-skel" style={{ width: 28 }} />
            </td>
          );
        }
        if (!prediction) {
          return (
            <td key={c} title={predStatus === "ready" ? t("live.tower.pred.none") : undefined}>
              <Dash />
            </td>
          );
        }
        const dir = prediction.delta == null ? null : prediction.delta > 0 ? "up" : prediction.delta < 0 ? "down" : "same";
        const rel =
          dir === "up"
            ? t("live.tower.pred.better", { count: prediction.delta })
            : dir === "down"
              ? t("live.tower.pred.worse", { count: -prediction.delta })
              : dir === "same"
                ? t("live.tower.pred.same")
                : "";
        const title = [t("live.tower.pred.cell", { predicted: prediction.predicted }), rel].filter(Boolean).join(", ");
        return (
          <td key={c} className="tabular lt-pred lt-dim" title={title} aria-label={title}>
            P{prediction.predicted}
            {dir && dir !== "same" && <b data-dir={dir}>{dir === "up" ? `▲${prediction.delta}` : `▼${-prediction.delta}`}</b>}
            {dir === "same" && <b>=</b>}
          </td>
        );
      }
      default:
        return <td key={c} />;
    }
  });

  return (
    <tr
      className="lt-row"
      data-n={row.driverNumber}
      aria-selected={selected}
      data-rival={rival ? "true" : undefined}
      data-gone={row.gone && isRace ? "true" : undefined}
      data-elim={elim ? "true" : undefined}
      data-elim-first={elimFirst ? "true" : undefined}
      tabIndex={tabbable ? 0 : -1}
    >
      {cells}
    </tr>
  );
}

export default memo(TowerRow);
