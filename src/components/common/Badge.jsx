const TONES = {
  sprint: "bg-(--color-accent) text-white",
  demo: "bg-(--color-warn) text-black",
  warn: "bg-(--color-warn) text-black",
  good: "bg-(--color-good) text-black",
  neutral: "bg-(--color-surface-2) text-(--color-text-dim) border border-(--color-line)",
};

// Pill-бейдж з наперед заданим тоном — Sprint/DEMO/Completed тощо,
// одне визначення замість className-дублів по сторінках.
export default function Badge({ tone = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-widest font-bold font-mono-data rounded-full px-2 py-0.5 ${TONES[tone] || TONES.neutral}`}
    >
      {children}
    </span>
  );
}
