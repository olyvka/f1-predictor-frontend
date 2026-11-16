// Керування replay (F у LIVE_UI_RESEARCH §3; на телефоні - липкий міні-плеєр).
// Завдання: L5, L4 (пресети offset), L13 (у mode "live" - лише «LIVE · затримка»).
// Дизайн: LIVE_UI_RESEARCH W9, §5.8. Власник: агент D.
//
// Пропси: layout: "mobile" | "tablet" | "desktop" | "wide" ("mobile" - міні-плеєр).
// Чисті функції (межі шкали, мітки, пресети) - ReplayControls/timeline.js.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReplay, useClockLocal, useSession, useLiveParams, useLiveSelector, useLapCounter, shallowEqual } from "../../live/hooks";
import { formatClock } from "../../live/format";
import { formatTrackClock } from "./RaceControlPanel/rc";
import {
  SPEEDS,
  BUFFERING_SPEED,
  KEY_DEBOUNCE_MS,
  timelineBounds,
  clamp,
  fraction,
  leaderFrom,
  computeMarkers,
  lapAt,
  fromStartTime,
  lastLapsTime,
} from "./ReplayControls/timeline";
import { useReplayKeys } from "./ReplayControls/useReplayKeys";
import "./ReplayControls/controls.css";

const LAST_LAPS = 10;

// Дані для міток і пресетів: кола лідера, піти, race control (стабільний селектор).
const markerSource = (s) => {
  const leader = leaderFrom(s.position);
  return { leaderLaps: leader != null ? s.laps[leader] : undefined, pits: s.pits, rc: s.trackEvents };
};

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
  </svg>
);
const RestartIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M2 2.5v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function ReplayControls({ layout = "desktop" }) {
  const r = useReplay();
  const caps = r.capabilities;
  if (r.mode === "live" || (!caps.pause && !caps.speed && !caps.seek)) return <LiveStrip layout={layout} />;
  return <ReplayBar layout={layout} r={r} />;
}

function LiveStrip({ layout }) {
  const { t } = useTranslation();
  const clock = useClockLocal(1000);
  // Затримка = зараз − clock; невідома/неправдоподібна → очікувані ~3 с.
  const raw = clock != null ? (Date.now() - clock) / 1000 : null;
  const delay = raw != null && raw >= 0 && raw < 120 ? Math.max(1, Math.round(raw)) : 3;
  return (
    <div className="lrc-bar" data-mode="live" data-layout={layout} aria-label={t("live.controls.title")}>
      <span className="lrc-live-dot" aria-hidden="true" />
      <b className="uppercase tracking-wide">{t("live.controls.live")}</b>
      <span className="text-(--color-text-dim) tabular">· {t("live.controls.liveDelay", { seconds: delay })}</span>
    </div>
  );
}

function ReplayBar({ layout, r }) {
  const { t } = useTranslation();
  const { session, isRace, ready } = useSession();
  const { sourceKind } = useLiveParams();
  const { total } = useLapCounter();
  const clock = useClockLocal(250);
  const src = useLiveSelector(["table", "rc", "meta"], markerSource, shallowEqual);
  const caps = r.capabilities;
  const mobile = layout === "mobile";

  // Найраніший replay.start за час перегляду: після перемотування він зсувається.
  const [earliest, setEarliest] = useState(null);
  useEffect(() => {
    if (r.replayStart != null) setEarliest((e) => (e == null ? r.replayStart : Math.min(e, r.replayStart)));
  }, [r.replayStart]);
  const bounds = useMemo(
    () =>
      timelineBounds({
        sessionStart: r.sessionStart,
        replayStart: r.replayStart,
        replayEnd: r.replayEnd,
        earliestStart: earliest,
        clampToRecording: sourceKind === "fixture",
      }),
    [r.sessionStart, r.replayStart, r.replayEnd, earliest, sourceKind]
  );

  const markers = useMemo(
    () => computeMarkers({ leaderLaps: src.leaderLaps, raceControl: src.rc, pits: src.pits, isRace }),
    [src.leaderLaps, src.rc, src.pits, isRace]
  );
  const presets = useMemo(() => {
    const out = [];
    const start = fromStartTime({ leaderLaps: src.leaderLaps, raceControl: src.rc, sessionStart: r.sessionStart, isRace });
    if (start != null) out.push({ id: "start", t: start, label: t("live.controls.fromStart"), title: t("live.controls.fromStartHint") });
    const last = lastLapsTime({ leaderLaps: src.leaderLaps, total, count: LAST_LAPS, isRace });
    if (last)
      out.push({
        id: "last",
        t: last.t,
        label: t("live.controls.lastLaps", { count: LAST_LAPS }),
        title: last.estimated ? t("live.controls.lastLapsEstimated", { lap: last.lap }) : t("live.controls.lastLapsHint", { lap: last.lap }),
      });
    return out;
  }, [src.leaderLaps, src.rc, r.sessionStart, isRace, total, t]);

  // --- перемотування ---
  const [drag, setDrag] = useState(null); // мс під час перетягування
  const [hover, setHover] = useState(null); // мс під курсором (миша)
  const [pending, setPending] = useState(null); // мс накопиченого ←/→ (debounce)
  const pendingRef = useRef(null);
  const timerRef = useRef(null);
  const railRef = useRef(null);
  const seekingTarget = r.seeking?.target ?? null;
  const pos = drag ?? pending ?? seekingTarget ?? clock;
  const canSeek = caps.seek && ready && bounds != null && r.sessionStart != null;

  const latest = useRef({});
  latest.current = { clock, seekingTarget, bounds, seekToTime: r.seekToTime };

  const commit = useCallback((ms) => {
    clearTimeout(timerRef.current);
    pendingRef.current = null;
    setPending(null);
    const { clock: c, seekingTarget: st, bounds: b, seekToTime } = latest.current;
    if (ms == null || !b) return;
    const target = clamp(ms, b.lo, b.hi);
    const cur = st ?? c;
    if (cur != null && Math.abs(target - cur) < 500) return;
    seekToTime(target);
  }, []);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const nudge = useCallback(
    (seconds) => {
      const { clock: c, seekingTarget: st, bounds: b } = latest.current;
      if (!b || !canSeek) return;
      const base = pendingRef.current ?? st ?? c;
      if (base == null) return;
      const next = clamp(base + seconds * 1000, b.lo, b.hi);
      pendingRef.current = next;
      setPending(next);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => commit(pendingRef.current), KEY_DEBOUNCE_MS);
    },
    [canSeek, commit]
  );

  const ended = r.status === "ended" || r.ended;
  const startPreset = presets.find((p) => p.id === "start");
  const onPlay = useCallback(() => {
    if (ended) {
      if (startPreset) commit(startPreset.t);
      return;
    }
    r.togglePause();
  }, [ended, startPreset, commit, r]);

  useReplayKeys({ onToggle: onPlay, onNudge: nudge, pause: caps.pause && ready, seek: canSeek });

  const msFromX = (clientX) => {
    const el = railRef.current;
    if (!el || !bounds) return null;
    const rect = el.getBoundingClientRect();
    const f = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
    return bounds.lo + f * (bounds.hi - bounds.lo);
  };
  const dragRef = useRef(null);
  const onPointerDown = (e) => {
    if (!canSeek || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = msFromX(e.clientX);
    setDrag(dragRef.current);
  };
  const onPointerMove = (e) => {
    if (dragRef.current != null) {
      dragRef.current = msFromX(e.clientX);
      setDrag(dragRef.current);
    } else if (e.pointerType === "mouse" && canSeek) setHover(msFromX(e.clientX));
  };
  const onPointerUp = () => {
    if (dragRef.current == null) return;
    const v = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    commit(v);
  };
  const onPointerCancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  // --- підписи ---
  const elapsedOf = (ms) => (ms != null && r.sessionStart != null ? (ms - r.sessionStart) / 1000 : null);
  const timeText = formatClock(elapsedOf(pos), { hours: true });
  const totalText = formatClock(elapsedOf(bounds?.hi ?? null), { hours: true });
  const tipAt = drag ?? hover ?? pending;
  const tipLap = isRace ? lapAt(markers.laps, tipAt, clock ?? -Infinity) : null;
  const inRange = (ms) => bounds != null && ms >= bounds.lo && ms <= bounds.hi;
  const pct = (ms) => `${(fraction(ms, bounds) * 100).toFixed(3)}%`;
  const majorEvery = markers.laps.length > 40 ? 10 : 5;

  const playLabel = ended ? t("live.controls.restart") : r.paused ? t("live.controls.play") : t("live.controls.pause");
  const playButton = caps.pause && (
    <button
      type="button"
      className="lrc-play"
      onClick={onPlay}
      disabled={!ready || (ended && !startPreset)}
      aria-label={playLabel}
      title={`${playLabel} (Space)`}
    >
      {ended ? <RestartIcon /> : r.paused ? <PlayIcon /> : <PauseIcon />}
    </button>
  );

  const speedGroup = caps.speed && (
    <div className="lrc-seg lrc-speed" role="group" aria-label={t("live.controls.speed")}>
      {SPEEDS.map((s) => {
        const warn = s >= BUFFERING_SPEED;
        return (
          <button
            key={s}
            type="button"
            aria-pressed={r.speed === s}
            data-warn={warn}
            onClick={() => r.setSpeed(s)}
            title={warn ? `${t("live.controls.speedValue", { value: s })} · ${t("live.controls.bufferingHint")}` : t("live.controls.speedValue", { value: s })}
          >
            ×{s}
          </button>
        );
      })}
    </div>
  );

  const presetButtons = caps.seek && presets.length > 0 && (
    <div className="lrc-presets" role="group" aria-label={t("live.controls.presets")}>
      {presets.map((p) => (
        <button key={p.id} type="button" className="lrc-chip-btn" disabled={!canSeek} onClick={() => commit(p.t)} title={p.title}>
          {p.label}
        </button>
      ))}
    </div>
  );

  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <section className="lrc-bar tabular" data-layout={layout} aria-label={t("live.controls.title")}>
      {mobile && panelOpen && (
        <div className="lrc-panel" id="lrc-panel">
          {speedGroup}
          {presetButtons}
        </div>
      )}
      {playButton}
      {!mobile && speedGroup}

      {caps.seek && (
        <div className="lrc-timeline">
          <div
            ref={railRef}
            className="lrc-tl"
            role="slider"
            tabIndex={canSeek ? 0 : -1}
            aria-label={t("live.controls.timeline")}
            aria-disabled={!canSeek}
            aria-valuemin={0}
            aria-valuemax={Math.round(elapsedOf(bounds?.hi ?? null) ?? 0)}
            aria-valuenow={Math.round(elapsedOf(pos) ?? 0)}
            aria-valuetext={t("live.controls.timelineValue", { time: timeText })}
            title={mobile ? undefined : t("live.controls.keysHint")}
            data-dragging={drag != null}
            data-seeking={!!r.seeking}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            onPointerLeave={() => setHover(null)}
          >
            <div className="lrc-tl-rail">
              <div className="lrc-tl-fill" style={{ width: pct(pos) }} />
              {markers.laps.filter((l) => inRange(l.t)).map((l) => (
                <i key={l.lap} className="lrc-tl-lap" data-major={l.lap % majorEvery === 0} style={{ left: pct(l.t) }} />
              ))}
            </div>
            {markers.periods.filter((p) => bounds && (p.to ?? Infinity) >= bounds.lo && p.from <= bounds.hi).map((p) => (
              <i
                key={`${p.kind}-${p.from}`}
                className="lrc-tl-period"
                data-kind={p.kind}
                style={{ left: pct(p.from), width: `calc(${pct(p.to ?? clock ?? p.from)} - ${pct(p.from)})` }}
                title={t(`live.controls.marker.${p.kind}`)}
              />
            ))}
            {markers.yellows.filter((y) => inRange(y.t)).map((y, i) => (
              <i key={`y${i}`} className="lrc-tl-yellow" style={{ left: pct(y.t) }} />
            ))}
            {markers.pits.filter((p) => inRange(p.t)).map((p, i) => (
              <i key={`p${i}`} className="lrc-tl-pit" style={{ left: pct(p.t) }} />
            ))}
            {(drag != null || pending != null) && clock != null && <i className="lrc-tl-ghost" style={{ left: pct(clock) }} />}
            <div className="lrc-tl-thumb" style={{ left: pct(pos) }} />
            {tipAt != null && bounds && (
              <div className="lrc-tl-tip tabular" style={{ left: `clamp(48px, ${pct(tipAt)}, calc(100% - 48px))` }}>
                <b>{formatClock(elapsedOf(tipAt), { hours: true })}</b>
                {tipLap != null && <> · {t("live.controls.lapShort", { lap: tipLap })}</>}
                {!mobile && <small> · {formatTrackClock(tipAt, session?.gmt_offset)}</small>}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="lrc-time" data-pending={drag != null || pending != null || !!r.seeking} title={t("live.controls.elapsedTitle")}>
        <b>{timeText}</b>
        {!mobile && <> / {totalText}</>}
      </div>

      {!mobile && presetButtons}
      {mobile && (caps.speed || presets.length > 0) && (
        <button
          type="button"
          className="lrc-chip-btn lrc-more"
          aria-expanded={panelOpen}
          aria-controls="lrc-panel"
          aria-label={t("live.controls.more")}
          onClick={() => setPanelOpen((v) => !v)}
        >
          ×{r.speed} {panelOpen ? "▾" : "▴"}
        </button>
      )}

      {(layout === "desktop" || layout === "wide") && caps.seek && (
        <div className="lrc-foot">
          <span className="lrc-legend">
            {isRace && (
              <span>
                <i className="lap" />
                {t("live.controls.legend.lap")}
              </span>
            )}
            <span>
              <i style={{ background: "var(--color-flag-sc)" }} />
              {t("live.controls.legend.sc")}
            </span>
            <span>
              <i style={{ background: "var(--color-flag-red)" }} />
              {t("live.controls.legend.red")}
            </span>
            <span>
              <i style={{ background: "var(--color-flag-yellow)" }} />
              {t("live.controls.legend.yellow")}
            </span>
            <span>
              <i style={{ background: "var(--color-pit-lane)" }} />
              {t("live.controls.legend.pit")}
            </span>
          </span>
          {r.speed >= BUFFERING_SPEED && <span className="text-(--color-flag-sc)">● {t("live.controls.bufferingHint")}</span>}
          <span className="ml-auto">{t("live.controls.keysHint")}</span>
        </div>
      )}
    </section>
  );
}
