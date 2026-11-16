// Timing tower (B у LIVE_UI_RESEARCH §3).
// Завдання: L7 (таблиця позицій), частково L11 (сектори в кваліфікації).
// Дизайн: LIVE_UI_RESEARCH W3 (колонки, варіант кваліфікації, рух §5.6/§5.8,
// доступність), кольори таймінгу §5.2, шини §5.4, команди §5.5, типографіка §5.6.
// Власник: агент A. Дані - лише через хуки src/live/hooks.js (README «Хуки»).
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide" - набір колонок (§3: на
//           телефоні 4 колонки й рядки 40 px, ≥1680 - додаткові колонки).
//
// Рух: перестановка FLIP 300 мс з буфером подій 250 мс; підсвітка ▲/▼ 1.5 с і
// стрілки 5 с; на ×5+ підсвітка 0.4 с, без стрілок, reorder ≤ 1/с. Після
// catch-up/перемотування (tower.instant, новий epoch) - миттєво, без анімацій.
// Чиста логіка - TimingTower/logic.js, хуки руху - TimingTower/hooks.js.
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocus, useLiveSelector, usePredictions, useReplay, useSession, useTeamRadio, useTower } from "../../live/hooks";
import TowerRow from "./TimingTower/TowerRow";
import { useFocusAnnouncer, useLapGlow, useReducedMotion, useRowMotion, useStoredState, useTowerOrder } from "./TimingTower/hooks";
import {
  COLUMN_WIDTH,
  DEFAULT_GAP_MODE,
  GAP_MODES,
  columnsFor,
  displayRows,
  eliminationRange,
  inRange,
  intervalsStale,
  isQualifyingSession,
  latestQualifyingPhase,
  layoutHasPrediction,
  predictionCell,
} from "./TimingTower/logic";
import "./TimingTower/tower.css";

const SKELETON_ROWS = 22;
const LONG_PRESS_MS = 500;
const HEADER_ALIGN = { driver: "lt-l", chg: "lt-l", tyre: "lt-c" };

export default function TimingTower({ layout = "desktop" }) {
  const { t } = useTranslation();
  const tower = useTower();
  const { session, ready, driverList } = useSession();
  const { focus, rival, toggleFocus, setRival } = useFocus();
  const { speed } = useReplay();
  const clock = useLiveSelector("playback", (s) => s.playback.clock);
  const personalBest = useLiveSelector("table", (s) => s.personalBest);
  const qPhase = useLiveSelector("rc", (s) => latestQualifyingPhase(s.raceControl));
  const reducedMotion = useReducedMotion();

  const isRace = tower.isRace;
  const [gapMode, setGapMode] = useStoredState("live.tower.gapMode", DEFAULT_GAP_MODE, (v) => GAP_MODES.includes(v));
  const [showPred, setShowPred] = useStoredState("live.tower.showPrediction", true, (v) => typeof v === "boolean");
  const predVisible = isRace && showPred && layoutHasPrediction(layout, isRace);
  // Непрослухане радіо, що прийшло під час перегляду - позначка біля пілота.
  const radio = useTeamRadio();
  const preds = usePredictions({ enabled: predVisible && ready });

  const columns = useMemo(() => columnsFor(layout, isRace, { showPrediction: predVisible }), [layout, isRace, predVisible]);
  const rows = useMemo(() => displayRows(tower.rows, isRace), [tower.rows, isRace]);
  const order = useMemo(() => rows.map((r) => r.driverNumber), [rows]);
  const byNumber = useMemo(() => new Map(tower.rows.map((r) => [r.driverNumber, r])), [tower.rows]);

  const applied = useTowerOrder(order, { instant: tower.instant, epoch: tower.epoch, speed });
  const tbodyRef = useRef(null);
  const arrows = useRowMotion(tbodyRef, applied, { speed, reducedMotion });
  useLapGlow(tbodyRef, tower.rows, { epoch: tower.epoch, instant: tower.instant, speed, reducedMotion, enabled: true });

  const focusRow = focus != null ? byNumber.get(focus) || null : null;
  const refRow = focusRow || (tower.leaderNumber != null ? byNumber.get(tower.leaderNumber) : null) || null;
  const announcement = useFocusAnnouncer({ focusRow, epoch: tower.epoch, instant: tower.instant, t });

  const elimRange = !isRace && isQualifyingSession(session) ? eliminationRange(qPhase, driverList.length) : null;
  const digits = layout === "mobile" ? 1 : 3;
  const shownOrder = applied.order.filter((n) => byNumber.has(n));
  const [activeN, setActiveN] = useState(null);
  const tabbableN = [activeN, focus, shownOrder[0]].find((n) => n != null && byNumber.has(n));

  // --- взаємодія: клік / Shift-клік / довгий тап / клавіатура ---
  const longPress = useRef({ timer: null, fired: false, x: 0, y: 0 });
  const rowOf = (e) => {
    const tr = e.target.closest?.("tr[data-n]");
    return tr ? Number(tr.dataset.n) : null;
  };
  const toggleRival = useCallback((n) => setRival(rival === n ? null : n), [rival, setRival]);
  const onClick = (e) => {
    const n = rowOf(e);
    if (n == null) return;
    if (longPress.current.fired) {
      longPress.current.fired = false;
      return;
    }
    setActiveN(n);
    if (e.shiftKey) toggleRival(n);
    else toggleFocus(n);
  };
  const cancelLongPress = () => {
    clearTimeout(longPress.current.timer);
    longPress.current.timer = null;
  };
  const onPointerDown = (e) => {
    if (e.pointerType !== "touch") return;
    const n = rowOf(e);
    if (n == null) return;
    const lp = longPress.current;
    lp.fired = false;
    lp.x = e.clientX;
    lp.y = e.clientY;
    cancelLongPress();
    lp.timer = setTimeout(() => {
      lp.fired = true;
      lp.timer = null;
      toggleRival(n);
      navigator.vibrate?.(15);
    }, LONG_PRESS_MS);
  };
  const onPointerMove = (e) => {
    const lp = longPress.current;
    if (lp.timer && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) cancelLongPress();
  };
  const onKeyDown = (e) => {
    const n = rowOf(e);
    if (n == null) return;
    const idx = shownOrder.indexOf(n);
    let target = null;
    if (e.key === "ArrowDown") target = shownOrder[Math.min(shownOrder.length - 1, idx + 1)];
    else if (e.key === "ArrowUp") target = shownOrder[Math.max(0, idx - 1)];
    else if (e.key === "Home") target = shownOrder[0];
    else if (e.key === "End") target = shownOrder[shownOrder.length - 1];
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setActiveN(n);
      if (e.shiftKey) toggleRival(n);
      else toggleFocus(n);
      return;
    } else return;
    e.preventDefault();
    if (target == null) return;
    setActiveN(target);
    tbodyRef.current?.querySelector(`tr[data-n="${target}"]`)?.focus();
  };

  // --- заголовки ---
  const modeLabel = (m) => t(`live.tower.gap.${m}`);
  const cycleGap = () => setGapMode(GAP_MODES[(GAP_MODES.indexOf(gapMode) + 1) % GAP_MODES.length]);
  const gapTitle =
    gapMode === "focus"
      ? focusRow
        ? t("live.tower.gap.focusFull", { name: focusRow.driver?.acronym || focusRow.driverNumber })
        : t("live.tower.gap.focusFullNone")
      : t(`live.tower.gap.${gapMode}Full`);

  const header = (c) => {
    switch (c) {
      case "pos":
        return { text: t("live.tower.col.pos"), title: t("live.tower.col.posFull") };
      case "chg":
        return { text: "", title: t("live.tower.col.chgFull"), sr: t("live.tower.col.chg") };
      case "driver":
        return { text: t("live.tower.col.driver") };
      case "gap":
        return {
          node: (
            <button type="button" className="lt-th-btn" onClick={cycleGap} title={`${gapTitle}. ${t("live.tower.gap.cycle", { mode: modeLabel(gapMode) })}`}>
              {t(`live.tower.gap.${gapMode}Short`)}
            </button>
          ),
        };
      case "qgap":
        return { text: t("live.tower.quali.compact"), title: t("live.tower.quali.compactFull") };
      case "delta":
        return { text: t("live.tower.col.delta"), title: t("live.tower.col.deltaFull") };
      case "last":
        return { text: t("live.tower.col.last"), title: t("live.tower.col.lastFull") };
      case "best":
        return { text: t("live.tower.col.best"), title: t("live.tower.col.bestFull") };
      case "s1":
      case "s2":
      case "s3":
        return { text: c.toUpperCase(), title: t("live.tower.col.sectorFull", { n: c[1] }) };
      case "tyre":
        return { text: t("live.tower.col.tyre"), title: t("live.tower.col.tyreFull") };
      case "pit":
        return { text: t("live.tower.col.pit"), title: t("live.tower.col.pitFull") };
      case "pred":
        return {
          text: t("live.tower.col.pred"),
          title:
            preds.status === "error"
              ? t("live.tower.pred.error", { error: String(preds.error?.message || preds.error) })
              : preds.status === "loading"
                ? t("live.tower.pred.loading")
                : t("live.tower.col.predFull"),
        };
      default:
        return { text: "" };
    }
  };

  const loading = !ready || tower.rows.length === 0;
  const elimFirstN = elimRange ? shownOrder.find((n) => inRange(byNumber.get(n).position, elimRange)) : null;

  return (
    <section
      className="lt-panel flex flex-col min-h-0 h-full bg-(--color-surface) border border-(--color-line) rounded-md"
      data-layout={layout}
      data-race={isRace ? "true" : "false"}
      aria-label={t("live.tower.title")}
    >
      {layout !== "mobile" && (
        <header className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 border-b border-(--color-line)">
          <h2 className="uppercase tracking-widest text-xs font-semibold text-(--color-accent) mr-auto">{t("live.tower.title")}</h2>
          {isRace && (
            <div className="lt-seg" role="group" aria-label={t("live.tower.gap.label")}>
              {GAP_MODES.map((m) => (
                <button key={m} type="button" aria-pressed={gapMode === m} onClick={() => setGapMode(m)} title={t(`live.tower.gap.${m}Full`)}>
                  {layout === "tablet" ? t(`live.tower.gap.${m}Short`) : modeLabel(m)}
                </button>
              ))}
            </div>
          )}
          {isRace && layoutHasPrediction(layout, isRace) && (
            <label
              className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wide font-semibold text-(--color-text-dim) cursor-pointer"
              title={t("live.tower.col.predFull")}
            >
              <input type="checkbox" className="accent-(--color-accent) m-0" checked={showPred} onChange={(e) => setShowPred(e.target.checked)} />
              {t("live.tower.pred.toggle")}
            </label>
          )}
          {!isRace && qPhase != null && isQualifyingSession(session) && (
            <span className="lt-flag-chip" data-kind="phase" title={t("live.tower.phaseFull")}>
              {t("live.tower.phase", { phase: qPhase })}
            </span>
          )}
          {elimRange && (
            <span className="text-[11px] text-(--color-text-dim) inline-flex items-center gap-1.5">
              <i className="inline-block w-3 h-3 rounded-sm border border-dashed border-(--color-danger) bg-(--color-elimination-bg)" aria-hidden="true" />
              {t("live.tower.elimination.legend", { phase: qPhase, from: elimRange[0], to: elimRange[1] })}
            </span>
          )}
        </header>
      )}
      <div className={layout === "mobile" ? "" : "flex-1 min-h-0 overflow-y-auto overflow-x-hidden"}>
        <table className="lt-table" role="grid" aria-label={t("live.tower.tableLabel")} aria-describedby="lt-tower-hint" aria-busy={loading}>
          <colgroup>
            {columns.map((c) => (
              <col key={c} style={COLUMN_WIDTH[c] ? { width: COLUMN_WIDTH[c] } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((c) => {
                const h = header(c);
                return (
                  <th key={c} scope="col" className={HEADER_ALIGN[c] || ""} title={h.title}>
                    {h.node || h.text}
                    {h.sr && <span className="lt-sr">{h.sr}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          {loading ? (
            <tbody>
              {Array.from({ length: SKELETON_ROWS }, (_, i) => (
                <tr key={i} className="lt-row" aria-hidden="true">
                  {columns.map((c) => (
                    <td key={c}>
                      <span className="lt-skel" style={{ width: c === "driver" ? 64 : c === "pos" || c === "chg" || c === "pit" ? 12 : 36 }} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody
              ref={tbodyRef}
              onClick={onClick}
              onKeyDown={onKeyDown}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onContextMenu={(e) => longPress.current.fired && e.preventDefault()}
            >
              {shownOrder.map((n) => {
                const row = byNumber.get(n);
                const elim = inRange(row.position, elimRange);
                return (
                  <TowerRow
                    key={n}
                    row={row}
                    columns={columns}
                    t={t}
                    isRace={isRace}
                    gapMode={gapMode}
                    refRow={gapMode === "focus" ? refRow : null}
                    digits={digits}
                    selected={focus === n}
                    rival={rival === n}
                    tabbable={tabbableN === n}
                    arrow={arrows[n] || null}
                    elim={elim}
                    elimFirst={elim && elimFirstN === n}
                    elimLabel={t("live.tower.elimination.zone")}
                    stale={isRace && intervalsStale(row, clock)}
                    bestSectors={tower.bestSectors}
                    personalSectors={personalBest[n]?.sectors}
                    prediction={predVisible ? predictionCell(preds.byNumber[n], row.position) : null}
                    predStatus={preds.status}
                    radioNew={radio.unheardNew[n] || 0}
                  />
                );
              })}
            </tbody>
          )}
        </table>
        {loading && <p className="px-3 py-2 text-xs text-(--color-text-dim)">{t("live.tower.loadingRows")}</p>}
      </div>
      <p id="lt-tower-hint" className="lt-sr">
        {t("live.tower.hint")}
      </p>
      <div className="lt-sr" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}
