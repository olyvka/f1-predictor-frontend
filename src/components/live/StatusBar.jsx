// Статус-бар сесії (A у LIVE_UI_RESEARCH §3).
// Завдання: L5 (годинник «від старту» і «Коло X / Y» - разом із ReplayControls),
// L13 (бейдж REPLAY ×N / LIVE · затримка), L14 (індикатор свіжості/застарілих даних).
// Дизайн: LIVE_UI_RESEARCH W1, §5.6. Власник: агент A.
//
// Пропси (фінальні):
//   layout: "mobile" | "tablet" | "desktop" | "wide"
// Погода показується окремим віджетом WeatherChips у тому ж рядку (сторінка
// ставить його поруч), тут її не малюємо.
import { useTranslation } from "react-i18next";
import { useSession, useReplay, useClockLocal, useLapCounter } from "../../live/hooks";
import { formatClock } from "../../live/format";

export default function StatusBar({ layout = "desktop" }) {
  const { t } = useTranslation();
  const { session, ready } = useSession();
  const { status, speed, mode, sessionStart, lastEventAt } = useReplay();
  const clock = useClockLocal();
  const lap = useLapCounter();
  const elapsed = clock != null && sessionStart != null ? (clock - sessionStart) / 1000 : null;
  const staleFor = clock != null && lastEventAt != null ? Math.round((clock - lastEventAt) / 1000) : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border border-dashed border-(--color-line) bg-(--color-surface) rounded-md px-3 py-2 text-xs tabular">
      <span className="px-1.5 py-0.5 rounded bg-(--color-surface-2) font-bold uppercase">
        {mode === "live" ? t("live.common.liveBadge") : `${t("live.common.replayBadge")} ×${speed}`}
      </span>
      <b>{ready ? `${session.country_name} · ${session.session_name}` : t("live.common.loadingSession")}</b>
      <span>{lap.current != null ? (lap.total ? t("live.common.lapOf", { lap: lap.current, total: lap.total }) : t("live.common.lap", { lap: lap.current })) : "—"}</span>
      <span className="font-mono-data">{formatClock(elapsed, { hours: true })}</span>
      <span className="text-(--color-text-dim)">{t(`live.common.status.${status}`)}</span>
      <span className="text-(--color-text-dim)">
        stale={staleFor ?? "—"}s · layout={layout}
      </span>
      <span className="ml-auto text-[10px] uppercase text-(--color-text-dim)">{t("live.common.placeholder")} · W1 · A</span>
    </div>
  );
}
