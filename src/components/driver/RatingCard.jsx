import { Trans } from "react-i18next";
import Section from "../overview/Section";
import { t } from "../../i18n";

// Значення складової людською мовою — поруч із перцентилем.
const FORMATTERS = {
  quali_vs_teammate: (v) => t("rating.duels", { value: Math.round(v * 100) }),
  race_vs_teammate: (v) => t("rating.duels", { value: Math.round(v * 100) }),
  positions_gained: (v) => t("rating.gained", { value: `${v > 0 ? "+" : ""}${v.toFixed(1)}` }),
  consistency: (v) => t("rating.spread", { value: v.toFixed(1) }),
  incident_free: (v) => t("rating.races", { value: Math.round(v * 100) }),
  results: (v) => t("rating.pointsPerRace", { value: v.toFixed(1) }),
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
      <Section title={t("rating.title")}>
        <p className="text-sm text-(--color-text-dim)">{t("rating.notEnough")}</p>
      </Section>
    );
  }

  return (
    <Section title={t("rating.title")}>
      <div className="flex items-baseline gap-3">
        <span className="font-mono-data text-4xl font-bold" style={{ color: tone(rating.score) }}>
          {rating.score}
        </span>
        <span className="text-sm text-(--color-text-dim)">
          <Trans i18nKey="rating.rank" values={{ rank: rating.rank, of: rating.of }} components={{ b: <span className="text-(--color-text) font-semibold" /> }} />
        </span>
      </div>

      <ul className="flex flex-col gap-2.5">
        {rating.components.map((c) => (
          <li key={c.key} className="flex flex-col gap-1" title={t(`rating.components.${c.key}.hint`, { defaultValue: c.hint })}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span>{t(`rating.components.${c.key}.label`, { defaultValue: c.label })}</span>
              <span className="text-xs text-(--color-text-dim) font-mono-data">
                {c.value != null ? FORMATTERS[c.key]?.(c.value) ?? c.value : t("rating.lowData")}
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
        {t("rating.explain")}
      </p>
    </Section>
  );
}
