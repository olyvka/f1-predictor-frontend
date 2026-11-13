// Timing tower (B у LIVE_UI_RESEARCH §3).
// Завдання: L7 (таблиця позицій), частково L11 (сектори в кваліфікації).
// Дизайн: LIVE_UI_RESEARCH W3 (колонки, варіант кваліфікації, рух §5.6/§5.8,
// доступність), кольори таймінгу §5.2, шини §5.4, команди §5.5, типографіка §5.6.
// Власник: агент A. Дані - лише через хуки src/live/hooks.js (README «Хуки»).
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide" - набір колонок (§3: на
//           телефоні 4 колонки, ≥1680 - додаткові «найкраще коло», S1-S3).
//
// Заглушка нижче лише показує, що дані доходять. Анімації перестановки
// пропускати, коли tower.instant або змінився tower.epoch (catch-up/seek).
import { useTranslation } from "react-i18next";
import { useTower, useFocus } from "../../live/hooks";
import { formatGap, formatLapTime } from "../../live/format";
import { compoundMeta } from "../../live/tyres";
import WidgetStub from "./WidgetStub";

export default function TimingTower({ layout = "desktop" }) {
  const { t } = useTranslation();
  const tower = useTower();
  const { focus, toggleFocus } = useFocus();
  return (
    <WidgetStub title={t("live.tower.title")} tasks="L7 · W3 · A">
      <p className="mb-2 text-(--color-text-dim)">
        layout={layout} · epoch={tower.epoch} · instant={String(tower.instant)} · race={String(tower.isRace)}
      </p>
      <table className="w-full tabular">
        <tbody>
          {tower.rows.map((r) => (
            <tr
              key={r.driverNumber}
              onClick={() => toggleFocus(r.driverNumber)}
              aria-selected={focus === r.driverNumber}
              className={`cursor-pointer ${focus === r.driverNumber ? "bg-(--color-surface-2)" : ""} ${r.gone ? "opacity-50" : ""}`}
            >
              <td className="pr-2 text-right">{r.position ?? "—"}</td>
              <td className="pr-2">
                <span className="inline-block w-1 h-3 mr-1 align-middle" style={{ background: r.driver?.color }} />
                <b>{r.driver?.acronym}</b>
              </td>
              <td className="pr-2">
                {r.isLeader ? t("live.common.leader") : tower.isRace ? formatGap(r.interval, { t }) : formatGap(r.gapToBest, { t })}
              </td>
              <td className="pr-2">{formatLapTime(r.lastLapTime)}</td>
              <td className="pr-2">
                {compoundMeta(r.compound).letter}
                {r.tyreAge ?? ""}
              </td>
              <td className="pr-2">{r.pitCount || ""}</td>
              <td>
                {r.inPit && "PIT "}
                {r.gone && "OUT "}
                {r.blueFlag && "BLUE "}
                {r.warning && "⚠"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </WidgetStub>
  );
}
