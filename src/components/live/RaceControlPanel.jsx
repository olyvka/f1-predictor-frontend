// Стрічка race control (E у LIVE_UI_RESEARCH §3; на телефоні - вкладка «Події»).
// Завдання: L9 (стрічка повідомлень, мітка за flag, фільтри). Дизайн:
// LIVE_UI_RESEARCH W7 (фільтри Усі/Прапори/SC/Порушення/Інше - rcFilterKind у
// src/live/trackStatus.js; текст FIA не перекладаємо), кольори прапорів §5.3,
// W16 (тости піт-стопів / найшвидшого кола, nice). Власник: агент D.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
//
// Дані: useRaceControl() → {messages (новіші першими, ≤200; m.t - мс epoch),
// trackStatus}; useSession().drivers для TLA/кольору; useFocus() - підсвітка
// повідомлень про пілота у фокусі.
import { useTranslation } from "react-i18next";
import { useRaceControl } from "../../live/hooks";
import WidgetStub from "./WidgetStub";

export default function RaceControlPanel({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { messages } = useRaceControl();
  return (
    <WidgetStub title={t("live.events.title")} tasks="L9 · W7 · D">
      <p className="text-(--color-text-dim)">
        {messages.length} · {layout}
      </p>
      {!messages.length && <p className="text-(--color-text-dim)">{t("live.events.empty")}</p>}
      <ul className="mt-1 flex flex-col gap-1">
        {messages.slice(0, 30).map((m) => (
          <li key={`${m.t}-${m.message}`}>
            <span className="text-(--color-text-dim) tabular">{m.lap_number ?? "—"}</span> [{m.flag || m.category}] {m.message}
          </li>
        ))}
      </ul>
    </WidgetStub>
  );
}
