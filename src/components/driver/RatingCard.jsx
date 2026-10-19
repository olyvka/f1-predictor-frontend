import Section from "../overview/Section";

// Значення складової людською мовою — поруч із перцентилем.
const FORMATTERS = {
  quali_vs_teammate: (v) => `${Math.round(v * 100)}% дуелей`,
  race_vs_teammate: (v) => `${Math.round(v * 100)}% дуелей`,
  positions_gained: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)} поз. за гонку`,
  consistency: (v) => `розкид ±${v.toFixed(1)} поз.`,
  incident_free: (v) => `${Math.round(v * 100)}% гонок`,
  results: (v) => `${v.toFixed(1)} очк. за гонку`,
};

function tone(p) {
  if (p >= 70) return "var(--color-good)";
  if (p >= 40) return "var(--color-warn)";
  return "var(--color-danger)";
}

// Оцінка сезону 0–100: середнє перцентилів складових серед пілотів сезону
// (рахує бекенд). Показуємо кожну складову, щоб оцінка не була "чорною
// скринькою" — видно, за що саме вона висока чи низька.
export default function RatingCard({ rating }) {
  if (!rating) {
    return (
      <Section title="Оцінка сезону">
        <p className="text-sm text-(--color-text-dim)">Замало гонок для оцінки (потрібно щонайменше 5).</p>
      </Section>
    );
  }

  return (
    <Section title="Оцінка сезону">
      <div className="flex items-baseline gap-3">
        <span className="font-mono-data text-4xl font-bold" style={{ color: tone(rating.score) }}>
          {rating.score}
        </span>
        <span className="text-sm text-(--color-text-dim)">
          / 100 · <span className="text-(--color-text) font-semibold">{rating.rank}-й</span> з {rating.of} пілотів сезону
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {rating.components.map((c) => (
          <li key={c.key} className="flex flex-col gap-1" title={c.hint}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{c.label}</span>
              <span className="text-xs text-(--color-text-dim) font-mono-data">
                {c.value != null ? FORMATTERS[c.key]?.(c.value) ?? c.value : "мало даних"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-(--color-line) overflow-hidden">
                {c.percentile != null && (
                  <div className="h-full rounded-full" style={{ width: `${c.percentile}%`, background: tone(c.percentile) }} />
                )}
              </div>
              <span className="w-8 text-right text-xs font-mono-data">{c.percentile ?? "—"}</span>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-(--color-text-dim)">
        Кожна складова — перцентиль серед пілотів сезону з 5+ гонками (80 — кращий за 80% поля); оцінка — їх середнє.
        Вину в аваріях датасет не розрізняє.
      </p>
    </Section>
  );
}
