// Керування replay (F у LIVE_UI_RESEARCH §3; на телефоні - липкий міні-плеєр).
// Завдання: L5 (Play/Pause, швидкості 0.25-20, шкала часу з seek на відпускання,
// годинник «від старту» і «Коло X / Y», індикатор стану), L4 (пресети offset:
// «Від старту», «Останні 10 кіл»), L13 (у mode "live" - сховати швидкість, шкалу,
// паузу). Дизайн: LIVE_UI_RESEARCH W9, §5.8. Власник: агент D.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide" ("mobile" - міні-плеєр)
//
// Дані/дії: useReplay() → {paused, speed, clock, replayStart, replayEnd, sessionStart,
// capabilities, togglePause, setSpeed, seek(offsetSeconds), seekToTime(ms)},
// useClockLocal() для плавного таймера, useLapCounter(). Пауза оптимістична
// (годинник стоїть одразу). Seek = перепідключення; під час seeking стор
// тримає старий кадр (playback.seeking).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useReplay, useClockLocal } from "../../live/hooks";
import { formatClock } from "../../live/format";

const SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 20];

export default function ReplayControls({ layout = "desktop" }) {
  const { t } = useTranslation();
  const r = useReplay();
  const clock = useClockLocal();
  const [drag, setDrag] = useState(null);
  const min = r.replayStart != null && r.sessionStart != null ? (r.replayStart - r.sessionStart) / 1000 : 0;
  const max = r.replayEnd != null && r.sessionStart != null ? (r.replayEnd - r.sessionStart) / 1000 : 0;
  const pos = clock != null && r.sessionStart != null ? (clock - r.sessionStart) / 1000 : 0;
  const commit = () => {
    if (drag != null) r.seek(drag);
    setDrag(null);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border border-dashed border-(--color-line) bg-(--color-surface) rounded-md px-3 py-2 text-xs tabular">
      <button className="px-2 py-1 rounded bg-(--color-surface-2)" disabled={!r.capabilities.pause} onClick={r.togglePause}>
        {r.paused ? t("live.controls.play") : t("live.controls.pause")}
      </button>
      {layout !== "mobile" &&
        SPEEDS.map((s) => (
          <button key={s} aria-pressed={r.speed === s} disabled={!r.capabilities.speed} onClick={() => r.setSpeed(s)} className={`px-1.5 py-1 rounded ${r.speed === s ? "bg-(--color-accent) text-white" : ""}`}>
            ×{s}
          </button>
        ))}
      <input
        type="range"
        className="flex-1 min-w-32"
        min={min}
        max={max}
        step={1}
        value={drag ?? pos}
        disabled={!r.capabilities.seek || max <= min}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        aria-label={t("live.controls.title")}
      />
      <span className="font-mono-data">
        {formatClock(drag ?? pos, { hours: true })} / {formatClock(max, { hours: true })}
      </span>
      <span className="text-[10px] uppercase text-(--color-text-dim)">{t("live.common.placeholder")} · L5 · W9 · D</span>
    </div>
  );
}
