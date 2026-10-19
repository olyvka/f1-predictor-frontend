import { useElapsed } from "../../hooks/useElapsed";

// Помітний лоудер (не тиха skeleton-заглушка) — зі спінером, підписом, що
// саме зараз вантажиться на цій сторінці, і лічильником секунд, щоб було
// видно, що запит живий, а не завис. Перший запит по (year, round, session)
// без кешу на бекенді може тривати до 2 хвилин (таймаут запиту) — підказки
// з'являються на 6с/20с/45с замість мовчазного очікування.
export default function Loader({ label = "Завантаження…" }) {
  const elapsed = useElapsed(true);

  let hint = null;
  if (elapsed >= 45) {
    hint = "Це справді довге очікування — бекенд усе ще тягне дані ззовні. Запит перерветься сам через 2 хв, тоді можна буде повторити.";
  } else if (elapsed >= 20) {
    hint = "Це довше за звичне — бекенд ще тягне дані із зовнішнього джерела, чекаємо далі.";
  } else if (elapsed >= 6) {
    hint = "Перший запит по цих даних може тривати довше — далі він буде миттєвим (кешується і на сервері, і в браузері).";
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
      <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-accent)">Завантаження</p>
      <p className="text-sm text-(--color-text)">{label}</p>
      <p className="text-xs text-(--color-text-dim) font-mono-data">{elapsed}с</p>
      {hint && <p className="text-xs text-(--color-text-dim) max-w-xs">{hint}</p>}
    </div>
  );
}
