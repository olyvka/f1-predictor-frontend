import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatDelta } from "../../utils/time";

// Бекенд не рахує відставання між пілотами — лише сирі LapTime, тому
// кумулятивну дельту рахуємо тут. series[0] — референс (0 на всіх колах),
// решта — різниця кумулятивного часу відносно референса на кожному колі.
function cumulativeByLap(laps) {
  let sum = 0;
  const map = new Map();
  [...laps]
    .sort((a, b) => a.LapNumber - b.LapNumber)
    .forEach((l) => {
      if (l.LapTime != null) sum += l.LapTime;
      map.set(l.LapNumber, sum);
    });
  return map;
}

function buildDeltaData(series) {
  const [reference, ...others] = series;
  if (!reference) return [];
  const refCumulative = cumulativeByLap(reference.laps);
  const otherCumulatives = others.map((s) => ({ code: s.code, cumulative: cumulativeByLap(s.laps) }));
  const lapNumbers = [...refCumulative.keys()].sort((a, b) => a - b);
  return lapNumbers.map((lapNumber) => {
    const row = { LapNumber: lapNumber };
    otherCumulatives.forEach(({ code, cumulative }) => {
      if (cumulative.has(lapNumber)) {
        row[code] = cumulative.get(lapNumber) - refCumulative.get(lapNumber);
      }
    });
    return row;
  });
}

function DeltaTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="text-(--color-text-dim) mb-1">Коло {label}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey}: {formatDelta(p.value)}
          </p>
        ))}
    </div>
  );
}

// series: [{code, color, laps}] — перший елемент є референсом (лінія на 0).
export default function DeltaChart({ series, height = 240 }) {
  if (series.length < 2) return null;
  const data = buildDeltaData(series);
  const [reference, ...others] = series;

  if (!data.length) {
    return <p className="text-sm text-(--color-text-dim)">Недостатньо даних для розрахунку відставання.</p>;
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
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={formatDelta}
          width={64}
        />
        <ReferenceLine y={0} stroke={reference.color} strokeWidth={2} label={{ value: reference.code, fill: reference.color, fontSize: 11, position: "right" }} />
        <Tooltip content={<DeltaTooltip />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {others.map((s) => (
          <Line
            key={s.code}
            type="monotone"
            dataKey={s.code}
            name={s.code}
            stroke={s.color}
            strokeWidth={2}
            strokeDasharray={s.dash ? "6 3" : undefined}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
