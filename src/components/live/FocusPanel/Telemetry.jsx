// Жива телеметрія пілота у фокусі (W5, L8): швидкість, передача, газ, гальмо
// (лише вкл/викл - у даних 0/100), оберти. Без DRS (у 2026 car_data.drs = null),
// без ERS/палива/температур шин (LIVE_UI_RESEARCH §6).
//
// Показуємо фактичний семпл car_data на момент рендера карти
// (store.getRenderTime()), щоб гальмо загоралось тоді ж, коли машина на карті
// гальмує. Опитуємо буфер 8 разів/с, React оновлюється лише коли семпл змінився.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveSelector, useLiveStore } from "../../../live/hooks";
import { formatInt } from "../../../live/format";
import { RPM_MAX, SLOW_KMH, barPercent, formatRpm, gearLabel, isBraking, isStale, pickTelemetrySample } from "./helpers";

const POLL_MS = 125;

function readSample(store, n) {
  const rt = store.getRenderTime();
  const tel = store.getTelemetryLap(n);
  let sample = rt == null ? null : pickTelemetrySample(tel, rt);
  // Буфера кола ще немає (щойно підключились) - остання car_data зі стану.
  if (!sample && !tel?.current?.length && !tel?.previous?.length) sample = store.getState().carData[n] || null;
  return { sample, stale: isStale(sample?.t, rt) };
}

function useFocusSample(n) {
  const store = useLiveStore();
  const [state, setState] = useState(() => readSample(store, n));
  useEffect(() => {
    const tick = () => {
      const next = readSample(store, n);
      setState((prev) => (prev.sample === next.sample && prev.stale === next.stale ? prev : next));
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [store, n]);
  return state;
}

function Bar({ label, percent, value, color, instant }) {
  return (
    <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
      <span className="text-(--color-text-dim)">{label}</span>
      <span className="relative h-2 rounded bg-(--color-surface-hover) overflow-hidden" aria-hidden="true">
        <span
          className="absolute inset-y-0 left-0 w-full rounded origin-left"
          style={{
            transform: `scaleX(${percent / 100})`,
            background: color,
            transition: instant ? "none" : "transform 120ms linear",
          }}
        />
      </span>
      <span className="tabular text-right fp-val">{value}</span>
    </div>
  );
}

export default function Telemetry({ number, driver, inPit, gone }) {
  const { t } = useTranslation();
  const { sample, stale } = useFocusSample(number);
  // Нова session (перемотка, перепідключення) → стан застосовується миттєво, без переходів.
  const epoch = useLiveSelector("playback", (s) => s.playback.epoch);
  const [seenEpoch, setSeenEpoch] = useState(epoch);
  const instant = seenEpoch !== epoch;
  useEffect(() => {
    if (instant) {
      const id = requestAnimationFrame(() => setSeenEpoch(epoch));
      return () => cancelAnimationFrame(id);
    }
  }, [instant, epoch]);

  const speed = sample?.speed;
  const gear = sample?.gear ?? sample?.n_gear;
  const braking = isBraking(sample?.brake);
  const slow = !stale && typeof speed === "number" && speed < SLOW_KMH;
  const throttle = sample?.throttle;
  const overlay = gone ? t("live.focus.telemetry.gone") : inPit ? t("live.focus.telemetry.inPit") : null;
  const aria = t("live.focus.telemetry.aria", {
    driver: driver?.acronym ?? "",
    speed: formatInt(speed),
    gear: gearLabel(gear),
    throttle: formatInt(Math.min(100, throttle ?? NaN)),
    brake: braking ? t("live.focus.telemetry.brakeOn") : t("live.focus.telemetry.brakeOff"),
  });

  return (
    <div className="relative" data-stale={stale || undefined}>
      <div className={`flex flex-col gap-2.5 ${stale ? "[&_.fp-val]:text-(--color-text-dim) [&_.fp-big]:text-(--color-text-dim)" : ""}`} aria-label={aria} role="group">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-baseline gap-1 min-w-0">
            <span
              className="fp-big tabular text-[40px] font-semibold leading-none tracking-tight"
              style={slow ? { color: "var(--color-danger)" } : undefined}
            >
              {formatInt(speed)}
            </span>
            <span className="text-[13px] text-(--color-text-dim)">{t("live.focus.telemetry.kmh")}</span>
          </div>
          <div className="flex items-baseline gap-1 shrink-0" title={t("live.focus.telemetry.gear")}>
            <span className="fp-big tabular text-[40px] font-semibold leading-none">{gearLabel(gear)}</span>
            <span className="text-[13px] text-(--color-text-dim)">{t("live.focus.telemetry.gearShort")}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Bar
            label={t("live.focus.telemetry.throttle")}
            percent={stale ? 0 : barPercent(throttle)}
            value={formatInt(Math.min(100, throttle ?? NaN))}
            color="var(--color-timing-green)"
            instant={instant}
          />
          <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs">
            <span className="text-(--color-text-dim)">{t("live.focus.telemetry.brake")}</span>
            <span
              className="h-2 rounded"
              style={{
                background: braking && !stale ? "var(--color-danger)" : "var(--color-surface-hover)",
                transition: instant ? "none" : "background-color 100ms linear",
              }}
              aria-hidden="true"
            />
            <span className={`text-right fp-val ${braking && !stale ? "font-bold text-(--color-danger)" : ""}`}>
              {sample ? (braking ? t("live.focus.telemetry.brakeOn") : t("live.focus.telemetry.brakeOff")) : "—"}
            </span>
          </div>
          <Bar
            label={t("live.focus.telemetry.rpm")}
            percent={stale ? 0 : barPercent(sample?.rpm, RPM_MAX)}
            value={formatRpm(sample?.rpm)}
            color="var(--color-text-dim)"
            instant={instant}
          />
        </div>
        {stale && !overlay && <p className="text-[11px] text-(--color-text-dim)">{t("live.focus.telemetry.stale")}</p>}
      </div>
      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center rounded bg-(--color-surface)/70 backdrop-blur-[1px]">
          <span
            className={`text-xs font-bold uppercase tracking-wide px-2.5 py-1 rounded ${
              gone ? "border border-(--color-line) text-(--color-text-dim)" : "bg-(--color-pit-lane) text-white"
            }`}
          >
            {overlay}
          </span>
        </div>
      )}
    </div>
  );
}
