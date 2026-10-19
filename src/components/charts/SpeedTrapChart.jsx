import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { t } from "../../i18n";

const TRAPS = [
  { key: "SpeedI1", label: "I1" },
  { key: "SpeedI2", label: "I2" },
  { key: "SpeedFL", label: "FL" },
  { key: "SpeedST", label: "ST" },
];

// laps одного пілота — максимум на кожній із чотирьох точок заміру
// швидкості за сесію: де саме на трасі пілот був найшвидшим.
function buildData(laps) {
  return TRAPS.map(({ key, label }) => {
    let best = null;
    for (const lap of laps || []) {
      const v = lap[key];
      if (v != null && (best == null || v > best.value)) best = { value: v, lap: lap.LapNumber };
    }
    return { trap: label, value: best?.value ?? 0, lap: best?.lap ?? null };
  }).filter((d) => d.value > 0);
}

function ChartTooltip({ active, payload, color }) {
  if (!active || !payload?.length) return null;
  const { trap, value, lap } = payload[0].payload;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p style={{ color }}>
        {trap}: {t("units.kph", { value: Math.round(value) })}
      </p>
      {lap != null && <p className="text-(--color-text-dim)">{t("chart.lapLower", { lap })}</p>}
    </div>
  );
}

export default function SpeedTrapChart({ laps, color = "var(--color-accent)", height = 200 }) {
  const data = buildData(laps);

  if (!data.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("chart.noSpeed")}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="trap"
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <YAxis
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={(v) => `${v}`}
          width={40}
          domain={["dataMin - 10", "dataMax + 10"]}
        />
        <Tooltip content={<ChartTooltip color={color} />} cursor={{ fill: "var(--color-surface-2)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.trap} fill={color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
