// Плашка "число + підпис" — переюзна одиниця, з якої зібрані стрічки
// статистики на сезоні, погоді й профілі пілота.
export default function StatTile({ label, value, hint, accent }) {
  return (
    <div className="border border-(--color-line) bg-(--color-surface-2) rounded-md px-3.5 py-3 flex flex-col gap-1 min-w-0">
      <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim) font-mono-data">
        {label}
      </span>
      <span
        className={`font-mono-data text-xl font-bold truncate ${accent ? "text-(--color-accent)" : "text-(--color-text)"}`}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] text-(--color-text-dim)">{hint}</span>}
    </div>
  );
}
