import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { formatLapTime } from "../../utils/time";
import { median } from "../../utils/stats";
import { timeDomain } from "../../utils/chartAxis";

// laps — усе поле одразу (не один пілот): медіана й найкраще коло поля
// на кожному колі сесії, щоб побачити, коли траса "гумується" (швидшає)
// чи сідає (напр. під дощем).
function buildData(laps) {
  const byLap = new Map();
  for (const lap of laps || []) {
    if (lap.LapNumber == null || lap.LapTime == null || lap.IsAccurate === false) continue;
    if (!byLap.has(lap.LapNumber)) byLap.set(lap.LapNumber, []);
    byLap.get(lap.LapNumber).push(lap.LapTime);
  }
  return [...byLap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([lapNumber, times]) => ({
      LapNumber: lapNumber,
      median: median(times),
      best: Math.min(...times),
      count: times.length,
    }));
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const { count } = payload[0].payload;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="text-(--color-text-dim) mb-1">
        Коло {label} · {count} пілотів
      </p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatLapTime(p.value)}
        </p>
      ))}
    </div>
  );
}

export default function TrackEvolutionChart({ laps, height = 260 }) {
  const data = buildData(laps);
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
          tickFormatter={formatLapTime}
          domain={timeDomain}
          width={64}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="median" name="Медіана поля" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="best" name="Найкраще коло поля" stroke="var(--color-good)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
