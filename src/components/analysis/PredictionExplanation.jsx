import Section from "../overview/Section";
import { t } from "../../i18n";

// Фічі-прапорці (0/1) — показуємо "так/ні", а не число.
const FLAGS = new Set(["is_rookie", "progressed_to_q3", "new_team_period", "wx_fp_rain", "wx_q_rain"]);

function formatValue(feature, value) {
  if (feature.endsWith("_cat")) return null;
  if (value == null) return t("explain.noData");
  if (FLAGS.has(feature)) return value ? t("explain.yes") : t("explain.no");
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function signed(v) {
  const rounded = Math.abs(v) < 0.05 ? 0 : v;
  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(1)}`;
}

// Смужка від центру: вправо (зелена) — тягне до P1, вліво (червона) — вниз.
function DivergingBar({ value, max }) {
  const width = max > 0 ? Math.min(50, (Math.abs(value) / max) * 50) : 0;
  const positive = value >= 0;
  return (
    <div className="relative h-2 rounded-full bg-(--color-line)">
      <span className="absolute inset-y-0 left-1/2 w-px bg-(--color-text-dim)/60" />
      <span
        className="absolute inset-y-0 rounded-full"
        style={{
          width: `${width}%`,
          left: positive ? "50%" : `${50 - width}%`,
          background: positive ? "var(--color-good)" : "var(--color-danger)",
        }}
      />
    </div>
  );
}

function ImpactRow({ label, value, impact, max }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_7rem_3rem] sm:grid-cols-[16rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
      <span className="min-w-0">
        <span className="block truncate" title={label}>{label}</span>
        {value != null && <span className="block text-xs text-(--color-text-dim) font-mono-data">{value}</span>}
      </span>
      <DivergingBar value={impact} max={max} />
      <span
        className="text-right font-mono-data text-xs font-semibold"
        style={{ color: impact > 0.05 ? "var(--color-good)" : impact < -0.05 ? "var(--color-danger)" : "var(--color-text-dim)" }}
      >
        {signed(impact)}
      </span>
    </li>
  );
}

// Чому модель поставила пілота саме сюди: внески фіч (SHAP з самих дерев
// моделі, рахує бекенд) у позицію відносно середнього пілота в полі.
export default function PredictionExplanation({ prediction, predictions }) {
  if (!prediction) return null;
  const e = prediction.explanation;
  const title = t("explain.title", { position: prediction.predicted_position, driver: prediction.driver });

  if (!e) {
    return (
      <Section title={title}>
        <p className="text-sm text-(--color-text-dim)">{t("explain.missing")}</p>
      </Section>
    );
  }

  const groups = e.groups.filter((g) => Math.abs(g.impact) >= 0.05);
  const groupMax = Math.max(...groups.map((g) => Math.abs(g.impact)), 0.1);
  const factorMax = Math.max(...e.factors.map((f) => Math.abs(f.impact)), Math.abs(e.other), 0.1);

  // Наскільки прогноз щільний: різниця очікуваної позиції з сусідами.
  const sorted = [...predictions].sort((a, b) => a.predicted_position - b.predicted_position);
  const idx = sorted.findIndex((p) => p.driver_id === prediction.driver_id);
  const neighbour = sorted[idx === 0 ? 1 : idx - 1];
  const gap = neighbour ? Math.abs(neighbour.expected_position - prediction.expected_position) : null;

  return (
    <Section title={title}>
      <div className="flex flex-col gap-1 text-sm">
        <p>
          {t(e.total >= 0 ? "explain.better" : "explain.worse", {
            expected: prediction.expected_position.toFixed(1),
            value: Math.abs(e.total).toFixed(1),
          })}
        </p>
        {gap != null && (
          <p className="text-(--color-text-dim)">
            {t(idx === 0 ? "explain.gapNext" : "explain.gapPrev", {
              driver: neighbour.driver,
              position: neighbour.predicted_position,
              value: gap.toFixed(1),
            })}{" "}
            {gap < 0.5 ? t("explain.tight") : ""}
          </p>
        )}
        {prediction.p_dnf != null && (
          <p className="text-(--color-text-dim)">{t("explain.dnf", { value: Math.round(prediction.p_dnf * 100) })}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim)">{t("explain.byGroup")}</h4>
        <ul className="flex flex-col gap-2">
          {groups.map((g) => (
            <ImpactRow key={g.group} label={t(`explain.group.${g.group}`)} impact={g.impact} max={groupMax} />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim)">{t("explain.topFactors")}</h4>
        <ul className="flex flex-col gap-2.5">
          {e.factors.map((f) => (
            <ImpactRow
              key={f.feature}
              label={f.label || f.feature}
              value={formatValue(f.feature, f.value)}
              impact={f.impact}
              max={factorMax}
            />
          ))}
          <ImpactRow label={t("explain.other")} impact={e.other} max={factorMax} />
        </ul>
      </div>

      <p className="text-[11px] text-(--color-text-dim)">{t("explain.method")}</p>
    </Section>
  );
}
