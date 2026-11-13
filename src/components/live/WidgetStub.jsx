import { useTranslation } from "react-i18next";

// Тимчасова рамка заглушок віджетів (фундамент). Коли віджет реалізовано,
// він перестає її використовувати; файл приберемо, коли заглушок не лишиться.
export default function WidgetStub({ title, tasks, className = "", children }) {
  const { t } = useTranslation();
  return (
    <section className={`flex flex-col min-h-0 h-full border border-dashed border-(--color-line) bg-(--color-surface) rounded-md ${className}`}>
      <header className="flex items-center gap-2 px-3 py-2 border-b border-(--color-line)">
        <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-(--color-text-dim)">
          {t("live.common.placeholder")} · {tasks}
        </span>
      </header>
      <div className="flex-1 min-h-0 overflow-auto p-3 text-xs">{children}</div>
    </section>
  );
}
