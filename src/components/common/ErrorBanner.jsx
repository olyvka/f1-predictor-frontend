// Бекенд завжди повертає помилки як {"detail": "..."} — показуємо цей
// текст користувачу напряму, а не generic "Сталася помилка". `onRetry`
// (якщо переданий) додає кнопку, щоб не залишати користувача в глухому
// куті після таймауту довгого першого запиту.
export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div
      className="border border-(--color-line) bg-(--color-surface-2) rounded-md px-4 py-3 flex items-start justify-between gap-3"
      style={{ borderLeft: "3px solid var(--color-danger)" }}
    >
      <div>
        <p className="text-[11px] uppercase tracking-widest font-bold text-(--color-danger) mb-0.5">Помилка</p>
        <p className="text-sm text-(--color-text)">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="shrink-0 text-xs uppercase tracking-wide font-semibold px-3 py-1.5 rounded-md border border-(--color-line) text-(--color-text-dim) hover:text-(--color-text) hover:border-(--color-danger) transition-colors"
        >
          Спробувати ще раз
        </button>
      )}
    </div>
  );
}
