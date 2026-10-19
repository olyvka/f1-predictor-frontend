import { Link } from "react-router-dom";

// Картка-блок сторінки "Огляд": заголовок капсом, опційне посилання
// праворуч ("Повна таблиця →") і вміст.
export default function Section({ title, action, children, className = "" }) {
  return (
    <section className={`border border-(--color-line) bg-(--color-surface-2) rounded-md p-4 flex flex-col gap-3 ${className}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-xs uppercase tracking-widest font-semibold text-(--color-text-dim)">{title}</h3>
        {action && (
          <Link
            to={action.to}
            className="shrink-0 text-xs uppercase tracking-wide font-semibold text-(--color-text-dim) hover:text-(--color-accent) transition-colors"
          >
            {action.label} →
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

// Рядок "підпис — значення" для списків фактів.
export function Fact({ label, children, hint }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-(--color-line) first:border-t-0 text-sm">
      <span className="text-(--color-text-dim) shrink-0">{label}</span>
      <span className="text-right min-w-0">
        <span className="font-mono-data">{children}</span>
        {hint && <span className="block text-[11px] text-(--color-text-dim)">{hint}</span>}
      </span>
    </div>
  );
}
