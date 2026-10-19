import { useMemo, useState } from "react";
import { formatLapTime } from "../../utils/time";
import { tyreColor } from "../../utils/constants";
import { quantile } from "../../utils/stats";
import { t } from "../../i18n";

// Recharts не має box-plot-примітиву — малюємо самі: тонкий вусик
// (min→max) + прямокутник (Q1→Q3) з рискою медіани, спільна шкала часу
// на всі стінти (швидше — вище, як і скрізь у застосунку).

function buildStints(laps) {
  const byStint = new Map();
  for (const lap of laps) {
    if (lap.Stint == null || lap.LapTime == null || lap.IsAccurate === false) continue;
    if (!byStint.has(lap.Stint)) byStint.set(lap.Stint, { stint: lap.Stint, compound: lap.Compound, values: [] });
    byStint.get(lap.Stint).values.push(lap.LapTime);
  }
  return [...byStint.values()]
    .filter((s) => s.values.length >= 2) // box без розкиду не інформативний
    .map((s) => {
      const sorted = [...s.values].sort((a, b) => a - b);
      return {
        ...s,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        q1: quantile(sorted, 0.25),
        median: quantile(sorted, 0.5),
        q3: quantile(sorted, 0.75),
      };
    })
    .sort((a, b) => a.stint - b.stint);
}

const HEIGHT = 220;
const PADDING = 16;
const COLUMN_WIDTH = 84;
const AXIS_GUTTER = 64; // вміщає "1:15.162" шрифтом 10px
const TICKS = 5;

export default function StintBoxPlot({ laps }) {
  const stints = useMemo(() => buildStints(laps || []), [laps]);
  const [hovered, setHovered] = useState(null);

  if (stints.length < 1) {
    return <p className="text-sm text-(--color-text-dim)">{t("charts.noStintSpread")}</p>;
  }

  const globalMin = Math.min(...stints.map((s) => s.min));
  const globalMax = Math.max(...stints.map((s) => s.max));
  const span = globalMax - globalMin || 1;
  const scaleY = (v) => PADDING + ((v - globalMin) / span) * (HEIGHT - 2 * PADDING);

  const width = AXIS_GUTTER + stints.length * COLUMN_WIDTH;
  const ticks = Array.from({ length: TICKS }, (_, i) => globalMin + (span * i) / (TICKS - 1));

  return (
    <div className="relative overflow-x-auto">
      <svg width={width} height={HEIGHT} className="max-w-full">
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={AXIS_GUTTER}
              x2={width}
              y1={scaleY(t)}
              y2={scaleY(t)}
              stroke="var(--color-line)"
              strokeDasharray="3 3"
            />
            <text x={AXIS_GUTTER - 8} y={scaleY(t) + 3} textAnchor="end" fontSize="10" fill="var(--color-text-dim)" className="font-mono-data">
              {formatLapTime(t)}
            </text>
          </g>
        ))}

        {stints.map((s, i) => {
          const cx = AXIS_GUTTER + i * COLUMN_WIDTH + COLUMN_WIDTH / 2;
          const color = tyreColor(s.compound);
          const boxWidth = COLUMN_WIDTH * 0.5;
          return (
            <g
              key={s.stint}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              style={{ cursor: "default" }}
            >
              <line x1={cx} x2={cx} y1={scaleY(s.min)} y2={scaleY(s.max)} stroke={color} strokeWidth={1.5} />
              <rect
                x={cx - boxWidth / 2}
                y={scaleY(s.q3)}
                width={boxWidth}
                height={Math.max(1, scaleY(s.q1) - scaleY(s.q3))}
                fill={color}
                fillOpacity={hovered === i ? 0.55 : 0.35}
                stroke={color}
                strokeWidth={1.5}
                rx={2}
              />
              <line
                x1={cx - boxWidth / 2}
                x2={cx + boxWidth / 2}
                y1={scaleY(s.median)}
                y2={scaleY(s.median)}
                stroke={color}
                strokeWidth={2}
              />
              <text x={cx} y={HEIGHT - 2} textAnchor="middle" fontSize="10" fill="var(--color-text-dim)" className="font-mono-data">
                {t("charts.stintN", { stint: s.stint })}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered != null && (
        <div
          className="absolute top-0 -translate-x-1/2 bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data pointer-events-none z-10"
          style={{ left: AXIS_GUTTER + hovered * COLUMN_WIDTH + COLUMN_WIDTH / 2 }}
        >
          <p className="text-(--color-text-dim) mb-1">
            {t("charts.stintN", { stint: stints[hovered].stint })} — {stints[hovered].compound || "—"}
          </p>
          <p>{t("charts.best")}: {formatLapTime(stints[hovered].min)}</p>
          <p>{t("charts.median")}: {formatLapTime(stints[hovered].median)}</p>
          <p>{t("charts.worst")}: {formatLapTime(stints[hovered].max)}</p>
        </div>
      )}
    </div>
  );
}
