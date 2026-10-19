import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { formatSector } from "../../utils/time";
import { timeDomain } from "../../utils/chartAxis";

const SECTORS = [
  { key: "Sector1Time", label: "S1", color: "#4f7cff" },
  { key: "Sector2Time", label: "S2", color: "var(--color-warn)" },
  { key: "Sector3Time", label: "S3", color: "var(--color-good)" },
];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="text-(--color-text-dim) mb-1">Коло {label}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {formatSector(p.value)}
          </p>
        ))}
    </div>
  );
}

// laps одного пілота — три лінії секторів по колах: де саме темп
// починає падати раніше, ніж це видно по загальному часу кола.
export default function SectorTrendChart({ laps, height = 260 }) {
  const data = (laps || [])
    .filter((l) => l.LapNumber != null && l.IsAccurate !== false)
    .sort((a, b) => a.LapNumber - b.LapNumber);

  if (!data.length) {
    return <p className="text-sm text-(--color-text-dim)">Немає кіл для побудови графіка.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="LapNumber"
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          label={{ value: "Коло", position: "insideBottom", offset: -2, fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <YAxis
          reversed
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={formatSector}
          domain={timeDomain}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {SECTORS.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
