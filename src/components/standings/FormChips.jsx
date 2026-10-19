import { t } from "../../i18n";

// Форма за останні гонки: "1" "4" "DNF" плашками. Подіум — акцентом,
// очкова зона — нейтрально, поза очками — тьмяно, сходи — червоним.
function tone(label) {
  if (label === "DNF" || label === "DSQ") return "text-(--color-danger) border-(--color-danger)/40";
  const pos = Number(label);
  if (pos <= 3) return "bg-(--color-accent) text-white border-transparent";
  if (pos <= 10) return "text-(--color-text) border-(--color-line)";
  return "text-(--color-text-dim) border-(--color-line)";
}

export default function FormChips({ form }) {
  return (
    <span className="inline-flex gap-1">
      {form.map((f) => (
        <span
          key={f.round}
          title={t("form.round", { round: f.round, result: f.label === "DNF" ? t("form.dnf") : f.label === "DSQ" ? t("form.dsq") : `P${f.label}` })}
          className={`inline-flex items-center justify-center min-w-7 h-5 px-1 rounded border text-[10px] font-mono-data font-bold ${tone(f.label)}`}
        >
          {f.label}
        </span>
      ))}
    </span>
  );
}
