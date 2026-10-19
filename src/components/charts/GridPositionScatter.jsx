import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Cell } from "recharts";
import { teamHex } from "../../utils/constants";
import { t } from "../../i18n";

// points: [{code, teamColor, grid, position}] — усе поле одразу. Діагональ
// x=y — референс "без змін"; крапки вище неї (менша Position при тому ж
// Grid, вісь Y інвертована) = пілот піднявся, той самий факт, що і "Δ
// старт" текстом у таблиці результатів, тільки для всіх одразу.
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { code, grid, position } = payload[0].payload;
  const delta = grid - position;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="font-semibold">{code}</p>
      <p className="text-(--color-text-dim)">
        {t("charts.startToFinish", { grid, position })}
      </p>
      <p style={{ color: delta > 0 ? "var(--color-good)" : delta < 0 ? "var(--color-danger)" : "var(--color-text-dim)" }}>
        {delta === 0 ? t("charts.noChange") : t("charts.positionsDelta", { count: Math.abs(delta), sign: delta > 0 ? "+" : "−" })}
      </p>
    </div>
  );
}

export default function GridPositionScatter({ points, height = 320 }) {
  const clean = (points || []).filter((p) => p.grid != null && p.position != null);
  if (!clean.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("charts.noGridData")}</p>;
  }

  const max = Math.max(...clean.map((p) => Math.max(p.grid, p.position)), 1);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" />
        <XAxis
          type="number"
          dataKey="grid"
          domain={[1, max]}
          allowDecimals={false}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={(v) => `P${v}`}
          label={{ value: t("charts.start"), position: "insideBottom", offset: -4, fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <YAxis
          type="number"
          dataKey="position"
          reversed
          domain={[1, max]}
          allowDecimals={false}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={(v) => `P${v}`}
          label={{ value: t("charts.finish"), angle: -90, position: "insideLeft", fill: "var(--color-text-dim)", fontSize: 11 }}
          width={44}
        />
        <ReferenceLine segment={[{ x: 1, y: 1 }, { x: max, y: max }]} stroke="var(--color-text-dim)" strokeDasharray="4 4" />
        <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={clean} isAnimationActive={false}>
          {clean.map((p) => (
            <Cell key={p.code} fill={teamHex(p.teamColor)} r={5} />
          ))}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  );
}
