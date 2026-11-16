// Пілот у фокусі (D у LIVE_UI_RESEARCH §3; на телефоні - вкладка «Пілот»).
// Завдання: L8 (жива телеметрія + траса швидкості), L11 (сектори й міні-сектори,
// speed trap), L12 (плитка «Модель vs гонка», прогноз пілота, SHAP).
// Дизайн: LIVE_UI_RESEARCH W5, W6, W12, W13/§7.1, кольори §5.2, §6 (БЕЗ DRS -
// у 2026 car_data.drs завжди null; без температур шин, ERS, палива). Власник: агент C.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
//
// Частини - у FocusPanel/: Header (шапка), Telemetry (W5), SpeedTrace (W6,
// Canvas), LastLap (W12/L11), ModelVsRace (W13/L12), helpers.js (чисті функції
// з тестами в FocusPanel/__tests__).
//
// Дані: useFocusDriver() (вибраний або лідер), useDriverDetail(n), store-буфер
// телеметрії (Telemetry), useSpeedTrace(n), usePredictions - лише для гонки
// (модель прогнозує фініш гонки; перший запит етапу може тренувати модель,
// тож блок показує «рахується…», не блокуючи екран).
import { useTranslation } from "react-i18next";
import { useFocus, useFocusDriver, useDriverDetail, usePredictions, useSession } from "../../live/hooks";
import Header from "./FocusPanel/Header";
import Telemetry from "./FocusPanel/Telemetry";
import SpeedTrace from "./FocusPanel/SpeedTrace";
import LastLap from "./FocusPanel/LastLap";
import ModelVsRace from "./FocusPanel/ModelVsRace";

export default function FocusPanel({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { number, isFallback } = useFocusDriver();
  const { clear } = useFocus();
  const { isRace, ready } = useSession();
  const detail = useDriverDetail(number);
  const driver = detail?.driver ?? null;
  const pred = usePredictions({ enabled: ready && isRace });

  return (
    <section
      className="flex flex-col min-h-0 h-full border border-(--color-line) bg-(--color-surface) rounded-md"
      aria-label={t("live.focus.title")}
    >
      <Header detail={detail} driver={driver} number={number} isFallback={isFallback} onClear={clear} />
      {driver && (
        <div className="@container flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Широкий контейнер (планшет: панель під картою) - дві колонки. */}
          <div className="grid gap-4 p-3 @xl:grid-cols-2 @xl:gap-x-5" data-layout={layout}>
            <div className="flex flex-col gap-4 min-w-0">
              {/* key: інший пілот - нові смуги без переходу від чужих значень. */}
              <Telemetry key={number} number={number} driver={driver} inPit={detail.inPit} gone={detail.gone} />
              <SpeedTrace number={number} driver={driver} />
            </div>
            <div className="flex flex-col gap-4 min-w-0">
              <LastLap detail={detail} />
              {isRace && <ModelVsRace pred={pred} number={number} driver={driver} position={detail.position} gone={detail.gone} />}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
