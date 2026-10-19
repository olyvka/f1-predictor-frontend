import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// Накопичені очки по етапах — "боротьба за титул".
// rounds: [{round, name}]; series: [{key, label, color, dash?, values: [очки після кожного етапу]}]
function ChartTooltip({ active, payload, label, rounds }) {
  if (!active || !payload?.length) return null;
  const name = rounds.find((r) => r.round === label)?.name;
  const sorted = [...payload].sort((a, b) => b.value - a.value);
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs">
      <p className="text-(--color-text-dim) mb-1">
        Етап {label}
        {name && ` · ${name}`}
      </p>
      {sorted.map((p) => (
        <p key={p.dataKey} className="font-mono-data" style={{ color: p.color }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
}

export default function PointsProgressChart({ rounds, series, height = 300 }) {
  if (!rounds.length || !series.length) return null;
  const data = rounds.map((r, i) => {
    const row = { round: r.round };
    series.forEach((s) => (row[s.key] = s.values[i]));
    return row;
  });

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="round"
            stroke="var(--color-text-dim)"
            tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
            label={{ value: "Етап", position: "insideBottom", offset: -2, fill: "var(--color-text-dim)", fontSize: 11 }}
          />
          <YAxis stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} width={44} />
          <Tooltip content={<ChartTooltip rounds={rounds} />} />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash ? "6 3" : undefined}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-(--color-text-dim)">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <svg width="16" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="16" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash ? "4 2" : undefined} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
