import { Link } from "react-router-dom";
import { t } from "../../i18n";

// Мінімальний інлайн-трейл для верхнього бару (не pill-стрічка) — тьмяний
// текст, поточна сторінка виділена білим/жирним. items: [{label, to?}].
export default function Breadcrumb({ items }) {
  if (!items.length) return null;
  return (
    <nav className="flex items-center gap-1.5 text-xs min-w-0" aria-label={t("nav.breadcrumb")}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1 || !item.to;
        return (
          <span key={item.label} className="inline-flex items-center gap-1.5 min-w-0">
            {i > 0 && <span className="text-(--color-text-dim)/60">›</span>}
            {isLast ? (
              <span className="text-(--color-text) font-semibold truncate max-w-[16rem]">{item.label}</span>
            ) : (
              <Link
                to={item.to}
                className="text-(--color-text-dim) hover:text-(--color-text) transition-colors truncate max-w-[12rem]"
              >
                {item.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
