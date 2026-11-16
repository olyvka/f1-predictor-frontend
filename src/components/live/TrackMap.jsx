// Карта траси (C у LIVE_UI_RESEARCH §3). Завдання: L6, дизайн W4, §5.5, §5.8, §6.
// Власник: агент B.
//
// Пропси:
//   layout:    "mobile" | "tablet" | "desktop" | "wide"
//   labelMode: "focus" | "top" | "all" - початковий режим підписів (необов'язковий;
//              за замовчуванням "focus" на телефоні, "top" на ширших). Перемикач
//              у шапці карти дає змінити його.
//
// Уся анімація - в імперативному MapRenderer (TrackMap/renderer.js): він сам
// читає store.getRenderTime() / store.getCarsAt() у requestAnimationFrame, тож
// рух машин не викликає ререндерів React. Цей компонент лише передає йому
// сесію, контур, фокус, прапор, режим підписів і поворот, а також обробляє
// клік/hover і доступний текст.
//
// Чого не малюємо (§6): DRS-зон, номерів поворотів, жовтих прапорів на
// ділянках (лише прапор на всю трасу тонує контур), положення поперек траси.
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveStore, useSession, useFocus, useTrackStatus, useLiveSelector } from "../../live/hooks";
import { formatGap } from "../../live/format";
import { MapRenderer } from "./TrackMap/renderer";
import { HIT_RADIUS } from "./TrackMap/mapMath";

const MODES = ["focus", "top", "all"];
const TINT_FLAGS = new Set(["SC", "VSC", "RED"]);
const FLAG_COLOR = { SC: "var(--color-flag-sc)", VSC: "var(--color-flag-sc)", RED: "var(--color-flag-red)" };
const FLAG_INK = { SC: "var(--color-flag-ink)", VSC: "var(--color-flag-ink)", RED: "#fff" };

export default function TrackMap({ layout = "desktop", labelMode }) {
  const { t } = useTranslation();
  const store = useLiveStore();
  const { track, session, drivers, ready } = useSession();
  const { focus, rival, toggleFocus } = useFocus();
  const { status } = useTrackStatus();
  const flag = TINT_FLAGS.has(status?.state) ? status.state : null;

  const defaultMode = labelMode && MODES.includes(labelMode) ? labelMode : layout === "mobile" ? "focus" : "top";
  const [chosenMode, setChosenMode] = useState(null);
  const mode = chosenMode ?? defaultMode;
  const [turns, setTurns] = useState(0);
  const [shape, setShape] = useState({ hasShape: false, forming: false });
  const [hover, setHover] = useState(null);

  const wrapRef = useRef(null);
  const staticRef = useRef(null);
  const canvasRef = useRef(null);
  const tipRef = useRef(null);
  const rendererRef = useRef(null);

  // Підказка йде за машиною: позицію пише рендерер у кожному кадрі напряму в DOM.
  const onTooltip = useCallback((n, x, y) => {
    const el = tipRef.current;
    if (!el) return;
    if (n == null) {
      el.style.visibility = "hidden";
      return;
    }
    const wrap = wrapRef.current;
    // Біля правого краю підказка йде ліворуч від машини.
    const flip = wrap && x + 12 + el.offsetWidth > wrap.clientWidth - 4;
    const left = flip ? x - 12 - el.offsetWidth : x + 12;
    el.style.visibility = "visible";
    el.style.transform = `translate(${Math.round(left)}px, ${Math.round(Math.max(4, y - 34))}px)`;
  }, []);

  // Рендерер живе стільки ж, скільки стор і canvas.
  useEffect(() => {
    const r = new MapRenderer({
      store,
      staticCanvas: staticRef.current,
      canvas: canvasRef.current,
      colorsFrom: wrapRef.current,
      onTooltip,
      onShape: setShape,
    });
    rendererRef.current = r;
    if (import.meta.env.DEV) window.__liveMap = r; // вимірювання кадрів з консолі: __liveMap.getStats()
    const el = wrapRef.current;
    let dprQuery = null;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      r.setSize(Math.round(rect.width), Math.round(rect.height), window.devicePixelRatio || 1);
    };
    // Зміна devicePixelRatio (інший монітор) не завжди дає resize.
    const onDpr = () => {
      measure();
      watchDpr();
    };
    const watchDpr = () => {
      dprQuery?.removeEventListener("change", onDpr);
      dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
      dprQuery?.addEventListener("change", onDpr);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    watchDpr();
    document.fonts?.ready.then(() => {
      if (rendererRef.current !== r) return;
      r.measure();
      r.requestDraw();
    });
    return () => {
      ro.disconnect();
      dprQuery?.removeEventListener("change", onDpr);
      r.destroy();
      if (rendererRef.current === r) rendererRef.current = null;
      if (import.meta.env.DEV && window.__liveMap === r) delete window.__liveMap;
    };
  }, [store, onTooltip]);

  const sessionKey = session?.session_key ?? null;
  useEffect(() => rendererRef.current?.setDrivers(drivers), [drivers]);
  useEffect(() => rendererRef.current?.setTrack(track, sessionKey), [track, sessionKey]);
  useEffect(() => rendererRef.current?.setFocus(focus, rival), [focus, rival]);
  useEffect(() => rendererRef.current?.setFlag(flag), [flag]);
  useEffect(() => rendererRef.current?.setLabelMode(mode), [mode]);
  useEffect(() => rendererRef.current?.setQuarterTurns(turns), [turns]);
  useEffect(() => rendererRef.current?.setHover(hover), [hover]);

  const pointAt = (e) => {
    const rect = wrapRef.current.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const onClick = (e) => {
    const r = rendererRef.current;
    if (!r) return;
    const [x, y] = pointAt(e);
    const n = r.hitTest(x, y, HIT_RADIUS);
    if (n != null) toggleFocus(n);
  };
  const onPointerMove = (e) => {
    if (e.pointerType !== "mouse") return;
    const r = rendererRef.current;
    if (!r) return;
    const [x, y] = pointAt(e);
    const n = r.hitTest(x, y, HIT_RADIUS);
    e.currentTarget.style.cursor = n != null ? "pointer" : "default";
    setHover(n);
  };

  const tooltip = useTooltipText(hover, t);
  const summary = useFocusSummary(t);

  const showSkeleton = !ready || !shape.hasShape;
  const forming = ready && shape.forming;
  const compact = layout === "mobile";

  return (
    <section
      className="flex flex-col min-h-0 h-full border border-(--color-line) bg-(--color-surface) rounded-md overflow-hidden"
      aria-label={t("live.map.title")}
    >
      <header className="flex items-center gap-2 px-3 py-1.5 border-b border-(--color-line)">
        <h3 className="text-xs font-bold uppercase tracking-wide truncate">{t("live.map.title")}</h3>
        {flag && (
          <span
            className="shrink-0 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded"
            style={{ background: FLAG_COLOR[flag], color: FLAG_INK[flag] }}
            title={t("live.map.flag.label")}
          >
            {t(`live.map.flag.${flag}`)}
          </span>
        )}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <div role="group" aria-label={t("live.map.labels.group")} className="flex gap-0.5 rounded border border-(--color-line) bg-(--color-bg) p-0.5">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                title={t(`live.map.labels.${m}Hint`)}
                onClick={() => setChosenMode(m)}
                className={`px-2 rounded text-[11px] uppercase tracking-wide transition-colors duration-100 ${compact ? "min-h-9" : "py-0.5"} ${
                  mode === m ? "bg-(--color-surface-hover) text-(--color-text) font-semibold" : "text-(--color-text-dim) hover:text-(--color-text)"
                }`}
              >
                {t(`live.map.labels.${m}`)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setTurns((k) => (k + 1) % 4)}
            title={t("live.map.rotateHint")}
            aria-label={t("live.map.rotateHint")}
            className={`flex items-center gap-1 px-2 rounded border border-(--color-line) text-[11px] tabular text-(--color-text-dim) hover:text-(--color-text) transition-colors duration-100 ${
              compact ? "min-h-10" : "py-1"
            }`}
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t("live.map.rotate")}
          </button>
        </div>
      </header>

      <div ref={wrapRef} className="relative flex-1 min-h-0 select-none" style={{ touchAction: "manipulation" }}>
        <canvas ref={staticRef} className="absolute inset-0 w-full h-full block" aria-hidden="true" />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full block"
          role="img"
          aria-label={t("live.map.canvasLabel")}
          onClick={onClick}
          onPointerMove={onPointerMove}
          onPointerLeave={() => setHover(null)}
        />
        {showSkeleton && <MapSkeleton label={ready && !forming ? t("live.map.waiting") : null} />}
        <div
          ref={tipRef}
          className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded border border-(--color-line) bg-(--color-surface-2) px-2 py-1 text-[11px] font-semibold shadow-lg tabular"
          style={{ visibility: "hidden" }}
          aria-hidden="true"
        >
          {tooltip}
        </div>
        <div className="pointer-events-none absolute left-3 bottom-2 right-3 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-(--color-text-dim)">
          {forming && <span className="text-(--color-text) italic">{t("live.map.forming")}</span>}
          {!showSkeleton && (
            <>
              <span>{t("live.map.legend.pit")}</span>
              {!compact && <span>{t("live.map.legend.teammate")}</span>}
            </>
          )}
        </div>
        <p className="sr-only" aria-live="polite">
          {summary}
        </p>
      </div>
    </section>
  );
}

/** Скелет контуру до першої геометрії (W4: «до першого location»). */
function MapSkeleton({ label }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
      <svg viewBox="0 0 200 120" className="w-3/5 max-w-80 animate-pulse" aria-hidden="true">
        <path
          d="M30 85 C20 60 35 25 70 22 L140 18 C175 16 185 40 170 58 L150 78 C140 88 120 82 105 90 L60 102 C45 106 36 98 30 85 Z"
          fill="none"
          stroke="var(--color-surface-hover)"
          strokeWidth="9"
          strokeLinejoin="round"
        />
      </svg>
      {label && <p className="text-xs text-(--color-text-dim)">{label}</p>}
    </div>
  );
}

/** Текст підказки hover: «VER · P3 · +1.234» (у кваліфікації - відставання від найкращого кола). */
function useTooltipText(n, t) {
  const sel = useCallback(
    (_s, store) => {
      if (n == null) return "";
      const tower = store.getTower();
      const row = tower.rows.find((r) => r.driverNumber === n);
      if (!row) return "";
      const parts = [row.driver?.acronym ?? String(n)];
      if (row.position != null) parts.push(t("live.map.tooltip.position", { position: row.position }));
      if (row.inPit) parts.push(t("live.map.tooltip.pit"));
      else if (row.stale) parts.push(t("live.map.tooltip.stale"));
      if (tower.isRace && tower.hasIntervals) {
        parts.push(row.isLeader ? t("live.common.leader") : formatGap(row.interval, { t }));
      } else if (row.gapToBest != null) {
        parts.push(row.gapToBest === 0 ? t("live.common.leader") : formatGap(row.gapToBest, { t }));
      }
      return parts.join(" · ");
    },
    [n, t]
  );
  return useLiveSelector(["table", "meta"], sel);
}

/** Прихований текст для читачів екрана: вибраний пілот, позиція, піт-лейн. Змінюється рідко. */
function useFocusSummary(t) {
  const sel = useCallback(
    (s, store) => {
      const n = s.focus;
      if (n == null || !s.drivers[n]) return t("live.map.summary.none");
      const row = store.getTower().rows.find((r) => r.driverNumber === n);
      const parts = [t("live.map.summary.focus", { driver: s.drivers[n].full_name || s.drivers[n].acronym })];
      if (row?.position != null) parts.push(t("live.map.summary.position", { position: row.position }));
      if (row?.gone) parts.push(t("live.map.summary.gone"));
      else if (row?.inPit) parts.push(t("live.map.summary.pit"));
      return parts.join(", ");
    },
    [t]
  );
  return useLiveSelector(["focus", "table", "meta"], sel);
}
