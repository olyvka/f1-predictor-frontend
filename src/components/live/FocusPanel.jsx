// Пілот у фокусі (D у LIVE_UI_RESEARCH §3; на телефоні - вкладка «Пілот»).
// Завдання: L8 (жива телеметрія + траса швидкості), L11 (сектори й міні-сектори,
// speed trap), L12 (плитка «Модель vs гонка», прогноз пілота, SHAP).
// Дизайн: LIVE_UI_RESEARCH W5, W6, W12, W13/§7.1, кольори §5.2, §6 (БЕЗ DRS -
// у 2026 car_data.drs завжди null; без температур шин, ERS, палива). Власник: агент C.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
//
// Дані: useFocusDriver() (вибраний або лідер), useDriver(n), useDriverDetail(n),
// useCarData(n), useSpeedTrace(n) (частка кола 0..1), usePredictions({enabled}),
// useFocus() для «суперника». /api/analysis при першому запиті тренує модель -
// вмикати usePredictions лише коли потрібно (не блокувати екран).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useFocusDriver, useDriver, useDriverDetail, useCarData, useSpeedTrace, usePredictions, useFocus } from "../../live/hooks";
import { formatLapTime, formatInt } from "../../live/format";
import WidgetStub from "./WidgetStub";

export default function FocusPanel({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { number, isFallback } = useFocusDriver();
  const { rival } = useFocus();
  const driver = useDriver(number);
  const detail = useDriverDetail(number);
  const car = useCarData(number);
  const trace = useSpeedTrace(number);
  const [wantPrediction, setWantPrediction] = useState(false);
  const pred = usePredictions({ enabled: wantPrediction });
  return (
    <WidgetStub title={t("live.focus.title")} tasks="L8 · L11 · L12 · C">
      {isFallback && <p className="text-(--color-text-dim)">{t("live.focus.pickHint")}</p>}
      <p>
        <b style={{ color: driver?.color }}>{driver?.acronym ?? "—"}</b> {driver?.full_name} · P{detail?.position ?? "—"} · rival={rival ?? "—"} · {layout}
      </p>
      <p className="tabular">
        speed {formatInt(car?.speed)} · gear {car?.n_gear ?? "—"} · rpm {formatInt(car?.rpm)} · throttle {formatInt(car?.throttle)} · brake {car ? (car.brake > 0 ? "ON" : "off") : "—"}
      </p>
      <p className="tabular">
        last {formatLapTime(detail?.lastLap?.lap_duration)} (L{detail?.lastLap?.lap_number ?? "—"}) · PB {formatLapTime(detail?.personalBest?.lap)} · tyre {detail?.stint?.compound ?? "—"} {detail?.tyreAge ?? ""} · pits {detail?.pits.length ?? 0}
        {detail?.inPit ? " · PIT" : ""}
      </p>
      <p className="tabular">
        trace: lap {trace?.lapNumber ?? "—"} · current {trace?.current.length ?? 0} pts · previous {trace?.previous.length ?? 0} pts{trace?.partial ? " · partial" : ""}
      </p>
      <p className="tabular">
        model: {pred.status}
        {pred.status === "ready" && ` · P${pred.byNumber[number]?.predicted_position ?? "—"} · unmatched ${pred.unmatched.length}`}
        {!wantPrediction && (
          <button className="ml-2 underline" onClick={() => setWantPrediction(true)}>
            load
          </button>
        )}
      </p>
    </WidgetStub>
  );
}
