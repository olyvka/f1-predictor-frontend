import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ReferenceArea,
} from "recharts";
import { formatClock, formatLapTime } from "../../utils/time";
import { median } from "../../utils/stats";
import StatTile from "../common/StatTile";
import { timeDomain } from "../../utils/chartAxis";

// Кожен графік — окрема шкала Y (ніколи dual-axis): температура, вологість,
// вітер і темп мають різні одиниці. syncId+syncMethod="value" синхронізує
// вертикальну лінію/тултіп між графіками по спільній осі Time (сек. від
// початку сесії) — той самий відлік, що й у laps[].Time, звідси й темп
// поля нижче; "value", бо в темпу інша кількість точок, ніж у погоди.
function rainBands(data) {
  const bands = [];
  let start = null;
  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    if (point.Rainfall && start == null) start = point.Time;
    if (!point.Rainfall && start != null) {
      bands.push([start, data[i - 1].Time]);
      start = null;
    }
  }
  if (start != null) bands.push([start, data[data.length - 1].Time]);
  return bands;
}

// Медіанний темп поля прив'язаний до медіанного сесійного часу (laps[].Time),
// в якому це коло було проїдене — так вісь X лишається сумісною з погодою.
function paceOverTime(laps) {
  const byLap = new Map();
  for (const lap of laps || []) {
    if (lap.LapNumber == null || lap.LapTime == null || lap.Time == null || lap.IsAccurate === false) continue;
    if (!byLap.has(lap.LapNumber)) byLap.set(lap.LapNumber, { times: [], paces: [] });
    const e = byLap.get(lap.LapNumber);
    e.times.push(lap.Time);
    e.paces.push(lap.LapTime);
  }
  return [...byLap.values()]
    .map((e) => ({ Time: median(e.times), pace: median(e.paces) }))
    .filter((p) => p.Time != null && p.pace != null)
    .sort((a, b) => a.Time - b.Time);
}

function axisProps() {
  return {
    stroke: "var(--color-text-dim)",
    tick: { fill: "var(--color-text-dim)", fontSize: 11 },
  };
}

function ChartTooltip({ active, payload, label, unit, formatter }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="text-(--color-text-dim) mb-1">Час {formatClock(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {formatter ? formatter(p.value) : `${p.value}${unit}`}
        </p>
      ))}
    </div>
  );
}

export default function WeatherCharts({ points, laps }) {
  if (!points.length) {
    return <p className="text-sm text-(--color-text-dim)">Дані про погоду відсутні.</p>;
  }

  const bands = rainBands(points);
  const latest = points[points.length - 1];
  const max = (key) => Math.max(...points.map((p) => p[key] ?? -Infinity));
  const pace = laps ? paceOverTime(laps) : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile label="Повітря" value={`${latest.AirTemp?.toFixed(1) ?? "—"}°C`} hint={`Макс. ${max("AirTemp").toFixed(1)}°C`} />
        <StatTile label="Траса" value={`${latest.TrackTemp?.toFixed(1) ?? "—"}°C`} hint={`Макс. ${max("TrackTemp").toFixed(1)}°C`} accent />
        <StatTile label="Вологість" value={`${latest.Humidity?.toFixed(1) ?? "—"}%`} hint={`Макс. ${max("Humidity").toFixed(1)}%`} />
        <StatTile label="Вітер" value={`${latest.WindSpeed?.toFixed(1) ?? "—"} м/с`} hint={`Макс. ${max("WindSpeed").toFixed(1)} м/с`} />
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
          Температура (°C){bands.length > 0 && <span className="ml-2 text-(--color-accent)">дощ заштриховано</span>}
        </h4>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} syncId="weather" syncMethod="value" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
            {bands.map(([from, to], i) => (
              <ReferenceArea key={i} x1={from} x2={to} fill="var(--color-accent)" fillOpacity={0.12} />
            ))}
            <XAxis dataKey="Time" tickFormatter={formatClock} {...axisProps()} />
            <YAxis width={40} {...axisProps()} />
            <Tooltip content={<ChartTooltip unit="°C" />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="AirTemp" name="Повітря" stroke="#2f80ed" strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="TrackTemp" name="Траса" stroke="#ff5c5c" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">Вологість (%)</h4>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={points} syncId="weather" syncMethod="value" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="Time" tickFormatter={formatClock} {...axisProps()} />
            <YAxis width={40} {...axisProps()} />
            <Tooltip content={<ChartTooltip unit="%" />} />
            <Line type="monotone" dataKey="Humidity" name="Вологість" stroke="#43b04a" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">Вітер (м/с)</h4>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={points} syncId="weather" syncMethod="value" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="Time" tickFormatter={formatClock} {...axisProps()} />
            <YAxis width={40} {...axisProps()} />
            <Tooltip content={<ChartTooltip unit=" м/с" />} />
            <Line type="monotone" dataKey="WindSpeed" name="Швидкість вітру" stroke="#ffd400" strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {pace.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-widest text-(--color-text-dim) mb-2">
            Медіанний темп поля <span className="text-(--color-text-dim) normal-case">— зіставити з погодою вище</span>
          </h4>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={pace} syncId="weather" syncMethod="value" margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="Time" tickFormatter={formatClock} {...axisProps()} />
              <YAxis reversed width={56} domain={timeDomain} tickFormatter={formatLapTime} {...axisProps()} />
              <Tooltip content={<ChartTooltip formatter={formatLapTime} />} />
              <Line type="monotone" dataKey="pace" name="Медіана поля" stroke="var(--color-accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
