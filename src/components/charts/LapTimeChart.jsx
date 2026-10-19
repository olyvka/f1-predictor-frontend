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
import { formatLapTime } from "../../utils/time";
import { trackStatusSeverity, FLAG_BAND_COLORS, FLAG_BAND_LABELS } from "../../utils/constants";
import { timeDomain } from "../../utils/chartAxis";

// series: [{ code, color, dash?, laps: [{LapNumber, LapTime, IsAccurate, Deleted, PitInTime, PitOutTime, TrackStatus, PitDuration?}] }]
// IsAccurate:false кола прибираються з лінії (інакше викиди спотворюють
// шкалу) — крім кіл з піт-лейном: вони теж "неточні", але без них маркеру
// піт-стопу нема на чому стояти (раніше він малювався вгорі графіка), а
// повільніше коло в боксах — і є ціна стопу, яку варто бачити.
// `PitDuration` — опційне поле (домішує DriverPage з /api/csv/pitstops,
// FastF1 сам точної тривалості не дає) — якщо його нема, просто не
// показується, решта сторінок, що юзають цей компонент, не ламаються.
// Коло з піт-лейном лишаємо на лінії, лише якщо воно не довше за 1.5
// медіани чистих кіл — "стоп" під червоним прапором триває десятки хвилин і
// розтягнув би шкалу так, що решта кіл злилась би в пряму.
const PIT_LAP_MAX_RATIO = 1.5;

function cleanMedian(laps) {
  const t = laps.filter((l) => l.IsAccurate !== false && l.LapTime != null).map((l) => l.LapTime).sort((a, b) => a - b);
  return t.length ? t[Math.floor(t.length / 2)] : null;
}

function buildMergedData(series) {
  const medians = new Map(series.map((s) => [s.code, cleanMedian(s.laps)]));
  const lapNumbers = new Set();
  series.forEach((s) => s.laps.forEach((l) => lapNumbers.add(l.LapNumber)));
  const sorted = [...lapNumbers].sort((a, b) => a - b);
  return sorted.map((lapNumber) => {
    const row = { LapNumber: lapNumber };
    series.forEach((s) => {
      const lap = s.laps.find((l) => l.LapNumber === lapNumber);
      const pit = !!(lap && (lap.PitInTime || lap.PitOutTime));
      const median = medians.get(s.code);
      const plausiblePit = pit && lap.LapTime != null && (median == null || lap.LapTime <= median * PIT_LAP_MAX_RATIO);
      row[s.code] = lap && lap.LapTime != null && (lap.IsAccurate !== false || plausiblePit) ? lap.LapTime : null;
      row[`${s.code}__pit`] = pit;
      row[`${s.code}__pitDuration`] = lap?.PitDuration ?? null;
    });
    return row;
  });
}

// Прапорці стосуються траси в цілому, а не окремого пілота — беремо
// найсерйозніший стан кожного кола з-поміж усіх обраних пілотів і
// групуємо сусідні кола однакової категорії в один банер.
const SEVERITY_RANK = { yellow: 1, "safety-car": 2, red: 3 };

function flagBands(series) {
  const byLap = new Map();
  series.forEach((s) =>
    s.laps.forEach((l) => {
      if (l.LapNumber == null) return;
      const sev = trackStatusSeverity(l.TrackStatus);
      if (!sev) return;
      const current = byLap.get(l.LapNumber);
      if (!current || SEVERITY_RANK[sev] > SEVERITY_RANK[current]) byLap.set(l.LapNumber, sev);
    })
  );

  const lapNumbers = [...byLap.keys()].sort((a, b) => a - b);
  const bands = [];
  let open = null;
  for (const lap of lapNumbers) {
    const sev = byLap.get(lap);
    if (open && open.sev === sev && lap === open.to + 1) {
      open.to = lap;
    } else {
      if (open) bands.push(open);
      open = { sev, from: lap, to: lap };
    }
  }
  if (open) bands.push(open);
  return bands;
}

function makePitDot(code) {
  return ({ cx, cy, payload }) => {
    // Коло в боксах без часу (напр. піт-стоп на першому колі) — без маркера,
    // а не кружок угорі графіка.
    if (!payload[`${code}__pit`] || cy == null || Number.isNaN(cy)) return null;
    return (
      <circle
        key={`${code}-${payload.LapNumber}`}
        cx={cx}
        cy={cy}
        r={4}
        fill="var(--color-bg)"
        stroke="var(--color-accent)"
        strokeWidth={2}
      />
    );
  };
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="text-(--color-text-dim) mb-1">Коло {label}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.dataKey}: {formatLapTime(p.value)}
            {p.payload[`${p.dataKey}__pit`] &&
              (p.payload[`${p.dataKey}__pitDuration`] != null
                ? ` · піт-стоп ${p.payload[`${p.dataKey}__pitDuration`].toFixed(3)}с`
                : " · піт-стоп")}
          </p>
        ))}
    </div>
  );
}

export default function LapTimeChart({ series, height = 280 }) {
  const data = buildMergedData(series);

  if (!data.length) {
    return <p className="text-sm text-(--color-text-dim)">Немає кіл для побудови графіка.</p>;
  }

  const bands = flagBands(series);

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
          {bands.map((b, i) => (
            <ReferenceArea
              key={i}
              x1={b.from - 0.5}
              x2={b.to + 0.5}
              fill={FLAG_BAND_COLORS[b.sev]}
              fillOpacity={0.14}
              ifOverflow="visible"
            />
          ))}
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
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s) => (
            <Line
              key={s.code}
              type="monotone"
              dataKey={s.code}
              name={s.code}
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash ? "6 3" : undefined}
              dot={makePitDot(s.code)}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-(--color-text-dim) font-mono-data">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border-2 border-(--color-accent)" />
          Піт-стоп
        </span>
        {Object.entries(FLAG_BAND_LABELS).map(([sev, label]) => (
          <span key={sev} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: FLAG_BAND_COLORS[sev], opacity: 0.6 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
