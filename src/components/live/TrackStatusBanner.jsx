// Банер статусу траси (під статус-баром, на всю ширину; видно завжди, і на телефоні).
// Завдання: L9 (банер статусу траси). Дизайн: LIVE_UI_RESEARCH W2, кольори §5.3,
// рух §5.8 (slide-down + 2 пульси, без безкінечного миготіння). Власник: агент A.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
// Дані: useTrackStatus() → {status, banner}. banner == null → нічого не рендерити
// (CLEAR показується лише чіпом у StatusBar ~5 с за status.clearedAt).
import { useTranslation } from "react-i18next";
import { useTrackStatus } from "../../live/hooks";

export default function TrackStatusBanner({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { banner, status } = useTrackStatus();
  if (!banner) return null;
  return (
    <div role="status" className="border border-dashed border-(--color-flag-sc) rounded-md px-3 py-1.5 text-xs font-bold uppercase">
      {banner.kind}
      {banner.phase ? ` · ${banner.phase}` : ""}
      {banner.sectors.length ? ` · ${banner.sectors.map((s) => s.sector).join(", ")}` : ""}
      <span className="ml-2 font-normal normal-case text-(--color-text-dim)">
        {status.message} · {t("live.common.placeholder")} · W2 · A · {layout}
      </span>
    </div>
  );
}
