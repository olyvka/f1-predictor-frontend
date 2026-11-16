// Оверлеї стану з'єднання поверх сітки екрана Live (W15, L14). Власник: агент D.
//
// Пропси: layout: "mobile" | "tablet" | "desktop" | "wide".
// Сторінка рендерить компонент у `relative`-контейнері сітки: шар inset-0,
// кліки проходять крізь нього (картки - pointer-events-auto). На телефоні
// сторінка прокручується, тож картки й чіпи там - fixed відносно вікна.
// Під час playback.seeking сторінка сама приглушує сітку - тут лише напис.
// Чисті функції - ConnectionOverlay/overlay.js.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useReplay, useSession, useLiveParams, useLiveSource, useLiveStore, useClockLocal, useTower } from "../../live/hooks";
import { useElapsed } from "../../hooks/useElapsed";
import { formatGap, formatLapTime } from "../../live/format";
import { overlayView, staleSeconds, finalClassification, LOADING_LONG_S } from "./ConnectionOverlay/overlay";
import { fromStartTime } from "./ReplayControls/timeline";

const btn = "text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md transition-colors";
const btnPrimary = `${btn} bg-(--color-accent) text-white hover:brightness-110`;
const btnGhost = `${btn} border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-text-dim)`;

function Card({ tone = "accent", children, wide = false }) {
  return (
    <div
      className={`pointer-events-auto w-full ${wide ? "max-w-xl" : "max-w-md"} border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-3 shadow-[0_10px_30px_rgb(0_0_0/0.5)]`}
      style={{ borderLeft: `3px solid var(--color-${tone})` }}
    >
      {children}
    </div>
  );
}

const Spinner = () => <span className="w-4 h-4 shrink-0 rounded-full border-2 border-(--color-line) border-t-(--color-accent) animate-spin motion-reduce:animate-none" aria-hidden="true" />;

function useCountdown(retryAt) {
  const [left, setLeft] = useState(null);
  useEffect(() => {
    if (retryAt == null) {
      setLeft(null);
      return;
    }
    const read = () => setLeft(Math.max(0, Math.ceil((retryAt - performance.now()) / 1000)));
    read();
    const id = setInterval(read, 250);
    return () => clearInterval(id);
  }, [retryAt]);
  return left;
}

export default function ConnectionOverlay({ layout = "desktop" }) {
  const { t } = useTranslation();
  const r = useReplay();
  const { ready } = useSession();
  const { year, round, session } = useLiveParams();
  const source = useLiveSource();
  const [cancelled, setCancelled] = useState(false);
  const view = overlayView({ status: r.status, ready, seeking: r.seeking, ended: r.ended, cancelled });
  const elapsed = useElapsed(view === "loading" || view === "seeking");
  const left = useCountdown(r.status === "lost" ? r.reconnect?.retryAt ?? null : null);
  const mobile = layout === "mobile";
  const sessionPath = `/${year}/${round}/${session}`;

  const retry = () => {
    setCancelled(false);
    r.retry();
  };
  const cancel = () => {
    source?.close();
    setCancelled(true);
  };

  let center = null;
  let top = null;
  if (view === "cancelled") {
    center = (
      <Card tone="warn">
        <p className="text-sm font-semibold mb-1">{t("live.controls.overlay.cancelled")}</p>
        <p className="text-xs text-(--color-text-dim) mb-3">{t("live.controls.overlay.cancelledHint")}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={retry} className={btnPrimary}>
            {t("live.common.retry")}
          </button>
          <Link to={sessionPath} className={btnGhost}>
            ← {t("live.common.backToSession")}
          </Link>
        </div>
      </Card>
    );
  } else if (view === "error") {
    center = (
      <Card tone="danger">
        <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-danger) mb-1">{t("live.common.errorTitle")}</p>
        {r.error && <p className="text-sm mb-3 break-words">{r.error}</p>}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={retry} className={btnPrimary}>
            {t("live.common.retry")}
          </button>
          <Link to={sessionPath} className={btnGhost}>
            ← {t("live.common.backToSession")}
          </Link>
        </div>
      </Card>
    );
  } else if (view === "loading") {
    center = (
      <Card>
        <div className="flex items-start gap-3">
          <Spinner />
          <div className="min-w-0">
            <p className="text-sm">{t("live.common.loadingSession")}</p>
            <p className="text-xs text-(--color-text-dim) tabular">
              {t("live.common.loadingHint")} · {t("units.secondsSpaced", { value: elapsed })}
            </p>
            {elapsed >= LOADING_LONG_S && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <p className="text-xs text-(--color-warn)">{t("live.common.loadingLong")}</p>
                <button type="button" onClick={cancel} className={btnGhost}>
                  {t("live.controls.overlay.cancel")}
                </button>
              </div>
            )}
          </div>
        </div>
      </Card>
    );
  } else if (view === "seeking") {
    center = (
      <span className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-(--color-surface-2) border border-(--color-line) text-sm font-semibold shadow-lg tabular">
        <Spinner />
        {t("live.common.seeking")}
        {elapsed >= 3 && <span className="text-xs font-normal text-(--color-text-dim)">{t("live.controls.overlay.seekingHint")}</span>}
      </span>
    );
  } else if (view === "lost") {
    const card = (
      <Card tone="warn">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Spinner />
          <p className="text-sm flex-1 min-w-40">
            {t("live.common.lost")} {left != null && left > 0 ? t("live.common.reconnectIn", { seconds: left }) : t("live.common.reconnecting")}
            {r.reconnect?.attempt > 1 && <span className="text-xs text-(--color-text-dim)"> · {t("live.controls.overlay.attempt", { attempt: r.reconnect.attempt })}</span>}
          </p>
          <button type="button" onClick={retry} className={btnGhost}>
            {t("live.common.reconnectNow")}
          </button>
        </div>
      </Card>
    );
    if (ready) top = card;
    else center = card;
  } else if (view === "ended") {
    top = <EndedBanner mobile={mobile} sessionPath={sessionPath} analysisPath={`/${year}/${round}/analysis`} />;
  }

  const chipsVisible = !center && !top && (r.status === "buffering" || r.status === "playing");
  const pos = mobile ? "fixed" : "absolute";
  return (
    <>
      {center && (
        <div className={`pointer-events-none ${pos} inset-0 z-20 flex items-center justify-center p-4`} role={view === "error" ? "alert" : "status"} aria-live="polite">
          {center}
        </div>
      )}
      {top && (
        <div
          className={`pointer-events-none ${mobile ? "fixed inset-x-0" : "absolute inset-x-0"} z-20 flex justify-center px-3`}
          style={{ top: mobile ? "calc(var(--live-topbar-h, 55px) + 8px)" : 8 }}
          role="status"
          aria-live="polite"
        >
          {top}
        </div>
      )}
      {chipsVisible && <StatusChips mobile={mobile} />}
    </>
  );
}

// Чіпи «Буферизація» / «Немає нових даних N с» під верхньою зоною екрана.
function StatusChips({ mobile }) {
  const { t } = useTranslation();
  const r = useReplay();
  const clock = useClockLocal(500);
  const stale = staleSeconds({ status: r.status, paused: r.paused, seeking: r.seeking, clock, lastEventAt: r.lastEventAt, replayStart: r.replayStart });
  const buffering = r.status === "buffering";
  if (!buffering && stale == null) return null;
  const style = mobile ? { bottom: "calc(var(--live-controls-h, 64px) + 8px)" } : { top: "calc(var(--live-top-h, 56px) + 14px)" };
  return (
    <div className={`pointer-events-none ${mobile ? "fixed" : "absolute"} inset-x-0 z-20 flex justify-center gap-2 px-3`} style={style} role="status" aria-live="polite">
      {buffering && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-(--color-surface-2) border border-(--color-line) shadow-lg" title={t("live.controls.overlay.bufferingHint")}>
          <span aria-hidden="true">◐</span>
          {t("live.controls.overlay.buffering")}
        </span>
      )}
      {stale != null && (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-(--color-warn) text-black shadow-lg tabular" title={t("live.controls.overlay.staleHint")}>
          <span aria-hidden="true">◷</span>
          {t("live.controls.overlay.stale", { seconds: stale })}
        </span>
      )}
    </div>
  );
}

function EndedBanner({ mobile, sessionPath, analysisPath }) {
  const { t } = useTranslation();
  const tower = useTower();
  const r = useReplay();
  const store = useLiveStore();
  const [open, setOpen] = useState(true);
  const rows = finalClassification(tower.rows, { limit: mobile ? 5 : 10 });
  const isRace = tower.isRace;

  const watchAgain = () => {
    const s = store.getState();
    const leader = tower.leaderNumber;
    const t0 = fromStartTime({ leaderLaps: leader != null ? s.laps[leader] : null, raceControl: s.raceControl, sessionStart: s.sessionStart, isRace });
    if (t0 != null) r.seekToTime(t0);
  };

  const links = (
    <div className="flex flex-wrap gap-2">
      <Link to={sessionPath} className={btnPrimary}>
        {t("live.common.openResults")}
      </Link>
      <Link to={analysisPath} className={btnGhost}>
        {t("live.controls.overlay.openAnalysis")}
      </Link>
      {r.capabilities.seek && (
        <button type="button" onClick={watchAgain} className={btnGhost}>
          ↺ {t("live.controls.restart")}
        </button>
      )}
    </div>
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="pointer-events-auto inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full bg-(--color-surface-2) border border-(--color-line) shadow-lg"
        style={{ borderLeft: "3px solid var(--color-good)" }}
      >
        🏁 {t("live.common.ended")} · {t("live.controls.overlay.show")}
      </button>
    );
  }
  return (
    <Card tone="good" wide>
      <div className="flex items-start gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">🏁 {t("live.common.ended")}</p>
          <p className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">
            {isRace ? t("live.controls.overlay.finalTitle") : t("live.controls.overlay.finalTitleOther")}
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className={btnGhost} aria-label={t("live.controls.overlay.hide")} title={t("live.controls.overlay.hide")}>
          ✕
        </button>
      </div>
      {rows.length ? (
        <ol className={`grid gap-x-4 gap-y-0.5 mb-3 text-xs tabular ${mobile ? "grid-cols-1" : "grid-cols-2 grid-flow-col"}`} style={mobile ? undefined : { gridTemplateRows: `repeat(${Math.ceil(rows.length / 2)}, auto)` }}>
          {rows.map((row) => (
            <li key={row.driverNumber} className="flex items-center gap-2 py-0.5">
              <span className="w-5 text-right text-(--color-text-dim)">{row.position}</span>
              <i className="inline-block w-[3px] h-3 rounded-sm" style={{ background: row.color || "var(--color-text-dim)" }} aria-hidden="true" />
              <b className="w-10">{row.acronym}</b>
              <span className="ml-auto text-(--color-text-dim)">
                {isRace ? (row.isLeader ? t("live.common.leader") : formatGap(row.gap, { t, digits: 3 })) : formatLapTime(row.bestLap)}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-xs text-(--color-text-dim) mb-3">{t("live.controls.overlay.noClassification")}</p>
      )}
      {links}
    </Card>
  );
}
