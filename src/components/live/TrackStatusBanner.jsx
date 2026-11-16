// Банер статусу траси (під статус-баром, на всю ширину; видно завжди, і на телефоні).
// Завдання: L9 (банер статусу траси). Дизайн: LIVE_UI_RESEARCH W2, кольори §5.3,
// рух §5.8 (slide-down + 2 пульси, без безкінечного миготіння). Власник: агент A.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
// Дані: useTrackStatus() → {status, banner}. banner == null → нічого не рендерити
// (CLEAR показується лише чіпом у StatusBar ~5 с за status.clearedAt).
//
// Банер завжди з текстом (колір - не єдиний носій сенсу): SC/VSC - абревіатура в
// плашці, подвійний жовтий - дві смуги, жовті сектори - списком. Невідомий
// текст SC показується як є. Анімація лише при появі/зміні виду банера і не
// після catch-up/перемотування (новий epoch у тому ж рендері).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLiveSelector, useTrackStatus } from "../../live/hooks";
import { describeBanner } from "./TimingTower/logic";
import "./TimingTower/tower.css";

export default function TrackStatusBanner({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { banner, status } = useTrackStatus();
  const epoch = useLiveSelector("playback", (s) => s.playback.epoch);
  const info = describeBanner(banner);
  const kindKey = info ? `${banner.kind}|${banner.phase || ""}` : null;

  // Анімувати, лише якщо вид банера змінився без скидання стану (derive state from props).
  const [anim, setAnim] = useState({ kindKey, epoch, animate: false, seq: 0 });
  if (anim.kindKey !== kindKey || anim.epoch !== epoch) {
    const animate = kindKey != null && anim.kindKey !== kindKey && anim.epoch === epoch;
    setAnim({ kindKey, epoch, animate, seq: anim.kindKey !== kindKey ? anim.seq + 1 : anim.seq });
  }

  if (!info) return null;
  const sectorList = info.sectors.map((s) => (s.double ? t("live.tower.banner.double", { sector: s.sector }) : String(s.sector)));
  const text = info.textKey ? t(`live.tower.banner.${info.textKey}`) : info.raw;
  const showSectors = info.sectors.length > 0 && (info.textKey === "sectorYellow" || info.textKey === "sectorDoubleYellow");

  return (
    <div
      key={anim.seq}
      className="lt-banner"
      data-tone={info.tone}
      data-animate={anim.animate ? "true" : "false"}
      data-layout={layout}
      role="status"
      aria-label={t("live.tower.banner.label")}
    >
      {info.abbr && <span className="lt-banner-abbr">{info.abbr}</span>}
      {info.tone === "yellow" && (
        <span className="lt-banner-bars" aria-hidden="true">
          <i />
          {info.double && <i />}
        </span>
      )}
      {info.tone === "red" && (
        <span className="lt-banner-bars" aria-hidden="true">
          <i />
        </span>
      )}
      <span>{text}</span>
      {showSectors && <small>{t("live.tower.banner.sectors", { count: info.sectors.length, list: sectorList.join(", ") })}</small>}
      {status.lap != null && !showSectors && <small className="tabular">{t("live.tower.banner.lap", { lap: status.lap })}</small>}
    </div>
  );
}
