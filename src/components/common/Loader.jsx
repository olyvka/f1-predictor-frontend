import { useElapsed } from "../../hooks/useElapsed";
import { t } from "../../i18n";

// Помітний лоудер (не тиха skeleton-заглушка) — зі спінером, підписом, що
// саме зараз вантажиться на цій сторінці, і лічильником секунд, щоб було
// видно, що запит живий, а не завис. Перший запит по (year, round, session)
// без кешу на бекенді може тривати до 2 хвилин (таймаут запиту) — підказки
// з'являються на 6с/20с/45с замість мовчазного очікування.
export default function Loader({ label = t("common.loading") }) {
  const elapsed = useElapsed(true);

  let hint = null;
  if (elapsed >= 45) {
    hint = t("loader.hint45");
  } else if (elapsed >= 20) {
    hint = t("loader.hint20");
  } else if (elapsed >= 6) {
    hint = t("loader.hint6");
  }

  return (
    <div
      className="flex flex-col items-center gap-2 border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-10 text-center"
      style={{ borderLeft: "3px solid var(--color-accent)" }}
    >
      <span
        className="w-6 h-6 rounded-full border-2 border-(--color-line) border-t-(--color-accent) animate-spin"
        aria-hidden="true"
      />
      <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-accent)">{t("loader.title")}</p>
      <p className="text-sm text-(--color-text)">{label}</p>
      <p className="text-xs text-(--color-text-dim) font-mono-data">{t("units.seconds", { value: elapsed })}</p>
      {hint && <p className="text-xs text-(--color-text-dim) max-w-xs">{hint}</p>}
    </div>
  );
}
