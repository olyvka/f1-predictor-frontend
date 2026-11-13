// Погода (компактні чіпи у рядку статус-бару; на телефоні - лише траса + дощ).
// Завдання: L10. Дизайн: LIVE_UI_RESEARCH W8 (wind_direction - звідки дме,
// стрілка на dir + 180°; rainfall > 0 → синій чіп «Дощ»; stale > 3 хв). Власник: агент D.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
//
// Дані: useWeather() → остання погода або null («—» до першого значення).
import { useTranslation } from "react-i18next";
import { useWeather } from "../../live/hooks";
import { formatInt } from "../../live/format";

export default function WeatherChips({ layout = "desktop" }) {
  const { t } = useTranslation();
  const w = useWeather();
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs tabular text-(--color-text-dim) border border-dashed border-(--color-line) rounded-md px-2 py-1">
      <span>{t("live.controls.weather")}:</span>
      <span>air {formatInt(w?.air_temperature)}°</span>
      <span>track {formatInt(w?.track_temperature)}°</span>
      {layout !== "mobile" && <span>hum {formatInt(w?.humidity)}%</span>}
      {layout !== "mobile" && <span>wind {w?.wind_speed ?? "—"} m/s {w?.wind_direction ?? "—"}°</span>}
      <span>rain {w ? String(w.rainfall > 0) : "—"}</span>
    </div>
  );
}
