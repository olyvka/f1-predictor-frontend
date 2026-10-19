import { TYRE_COLORS, tyreColor } from "../../utils/constants";
import TyreBadge from "../results/TyreBadge";
import { t } from "../../i18n";

// rows: [{ label, stints: [{ compound, first_lap, last_lap }] }]
// Кожен стінт — сегмент шириною last_lap - first_lap + 1, кольором за
// compound (SOFT/MEDIUM/HARD/INTERMEDIATE/WET) — власна легенда компаундів,
// бекенд її не віддає.
export default function TyreStintTimeline({ rows, totalLaps }) {
  const max = totalLaps || Math.max(1, ...rows.flatMap((r) => r.stints.map((s) => s.last_lap || 0)));

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-3">
          <span className="w-14 shrink-0 text-xs font-mono-data font-semibold">{row.label}</span>
          <div className="flex-1 h-5 rounded overflow-hidden flex bg-(--color-line)">
            {row.stints.length === 0 ? (
              <div className="w-full h-full flex items-center justify-center text-[11px] text-(--color-text-dim)">
                {t("tyres.noData")}
              </div>
            ) : (
              row.stints.map((s, i) => {
                const laps = Math.max(1, (s.last_lap ?? s.first_lap) - s.first_lap + 1);
                const widthPct = (laps / max) * 100;
                return (
                  <div
                    key={i}
                    title={`${s.compound || "?"} · ${t("units.laps", { count: laps })}`}
                    className="h-full flex items-center justify-center text-[11px] font-semibold text-black/70 border-r border-(--color-bg) last:border-r-0"
                    style={{ width: `${widthPct}%`, background: tyreColor(s.compound) }}
                  >
                    {widthPct > 6 ? laps : ""}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function TyreLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-[11px] text-(--color-text-dim)">
      {Object.keys(TYRE_COLORS)
        .filter((k) => k !== "UNKNOWN")
        .map((compound) => (
          <span key={compound} className="inline-flex items-center gap-1.5">
            <TyreBadge compound={compound} size={14} />
            {compound}
          </span>
        ))}
    </div>
  );
}
