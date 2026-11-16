// Погода (компактні чіпи в рядку статус-бару; на телефоні - лише траса + дощ).
// Завдання: L10. Дизайн: LIVE_UI_RESEARCH W8 (wind_direction - звідки дме,
// стрілка на dir + 180°; rainfall > 0 → синій чіп «Дощ»; stale > 3 хв часу
// сесії; тренд траси ▲/▼ за 10 хв). Власник: агент D.
//
// Пропси: layout: "mobile" | "tablet" | "desktop" | "wide".
// Чисті функції - WeatherChips/weather.js.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWeather, useClockLocal, useLiveSelector } from "../../live/hooks";
import { formatInt, DASH } from "../../live/format";
import { windArrowRotation, compassPoint, isWeatherStale, isRaining, pushSample, trendDelta, trendDirection } from "./WeatherChips/weather";

const selectEpoch = (s) => s.playback.epoch;

function Chip({ children, title, tone, keep = true }) {
  if (!keep) return null;
  const toneCls =
    tone === "rain"
      ? "bg-(--color-flag-blue) text-white border-transparent"
      : "bg-(--color-surface-2) text-(--color-text-dim) border-(--color-line)";
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border whitespace-nowrap ${toneCls}`} title={title}>
      {children}
    </span>
  );
}

export default function WeatherChips({ layout = "desktop" }) {
  const { t } = useTranslation();
  const w = useWeather();
  const clock = useClockLocal(5000);
  const epoch = useLiveSelector("playback", selectEpoch);
  const compact = layout === "mobile";

  // Історія температури траси для тренду (у сторі лише остання погода).
  const [hist, setHist] = useState({ epoch, list: [] });
  useEffect(() => {
    setHist((h) => {
      const base = h.epoch === epoch ? h.list : [];
      const list = w ? pushSample(base, w.t, w.track_temperature) : base;
      return list === h.list && h.epoch === epoch ? h : { epoch, list };
    });
  }, [w, epoch]);
  const trend = trendDirection(trendDelta(hist.list));
  const delta = trendDelta(hist.list);

  const stale = isWeatherStale(w, clock);
  const staleMin = stale ? Math.floor((clock - w.t) / 60000) : 0;
  const rain = isRaining(w);
  const v = (x) => (w ? formatInt(x) : DASH);
  const rot = windArrowRotation(w?.wind_direction);
  const from = compassPoint(w?.wind_direction);
  const windSpeed = typeof w?.wind_speed === "number" ? w.wind_speed.toFixed(1) : DASH;

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 tabular self-center ${stale ? "opacity-60" : ""}`}
      role="group"
      aria-label={t("live.controls.weather.label")}
      title={!w ? t("live.controls.weather.noData") : stale ? t("live.controls.weather.stale", { minutes: staleMin }) : undefined}
      data-stale={stale}
    >
      {stale && (
        <span aria-hidden="true" className="text-(--color-text-dim) text-xs">
          ◷
        </span>
      )}
      <Chip keep={!compact}>
        {t("live.controls.weather.air")} <b className="text-(--color-text) font-semibold">{v(w?.air_temperature)}°</b>
      </Chip>
      <Chip
        title={
          trend === "up"
            ? t("live.controls.weather.trendUp", { delta: Math.abs(delta).toFixed(1) })
            : trend === "down"
              ? t("live.controls.weather.trendDown", { delta: Math.abs(delta).toFixed(1) })
              : undefined
        }
      >
        {t("live.controls.weather.track")} <b className="text-(--color-text) font-semibold">{v(w?.track_temperature)}°</b>
        {trend && <span className={trend === "up" ? "text-(--color-warn)" : "text-(--color-flag-blue)"}>{trend === "up" ? "▲" : "▼"}</span>}
      </Chip>
      <Chip keep={!compact}>
        <span aria-hidden="true">💧</span>
        <span className="sr-only">{t("live.controls.weather.humidity")}</span>
        <b className="text-(--color-text) font-semibold">{v(w?.humidity)}%</b>
      </Chip>
      <Chip
        keep={!compact}
        title={rot != null ? t("live.controls.weather.windTitle", { speed: windSpeed, from: t(`live.controls.weather.compass.${from}`), deg: Math.round(w.wind_direction) }) : t("live.controls.weather.wind")}
      >
        {rot != null ? (
          <svg viewBox="0 0 12 12" width="12" height="12" style={{ transform: `rotate(${rot}deg)` }} aria-hidden="true">
            <path d="M6 1 L9.5 10 L6 8 L2.5 10 Z" fill="currentColor" />
          </svg>
        ) : (
          <span>{t("live.controls.weather.wind")}</span>
        )}
        <b className="text-(--color-text) font-semibold">{windSpeed}</b> {t("units.mpsShort")}
      </Chip>
      {rain != null && (
        <Chip tone={rain ? "rain" : undefined}>
          {rain && (
            <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
              <path d="M6 1 C6 1 2.5 5.5 2.5 7.5 a3.5 3.5 0 0 0 7 0 C9.5 5.5 6 1 6 1 Z" fill="currentColor" />
            </svg>
          )}
          {rain ? t("live.controls.weather.rain") : t("live.controls.weather.dry")}
        </Chip>
      )}
    </div>
  );
}
