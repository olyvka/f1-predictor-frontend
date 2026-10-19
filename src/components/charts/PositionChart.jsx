import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { t } from "../../i18n";

// series: [{ code, color, dash?, laps: [{LapNumber, Position}] }] — увесь
// пелотон одразу (не гейтиться вибором пілотів, на відміну від
// LapTimeChart) — класична "карта боротьби": хто кого обігнав і коли.
function buildMergedData(series) {
  const lapNumbers = new Set();
  series.forEach((s) => s.laps.forEach((l) => lapNumbers.add(l.LapNumber)));
  const sorted = [...lapNumbers].sort((a, b) => a - b);
  return sorted.map((lapNumber) => {
    const row = { LapNumber: lapNumber };
    series.forEach((s) => {
      const lap = s.laps.find((l) => l.LapNumber === lapNumber);
      row[s.code] = lap?.Position ?? null;
    });
    return row;
  });
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const sorted = [...payload].filter((p) => p.value != null).sort((a, b) => a.value - b.value);
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data max-h-64 overflow-y-auto">
      <p className="text-(--color-text-dim) mb-1">{t("chart.lapN", { lap: label })}</p>
      {sorted.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          P{p.value} — {p.dataKey}
        </p>
      ))}
    </div>
  );
}

export default function PositionChart({ series, height = 340 }) {
  const data = buildMergedData(series);
  if (!data.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("chart.noLaps")}</p>;
  }

  const maxPosition = Math.max(1, ...series.flatMap((s) => s.laps.map((l) => l.Position || 0)));

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="LapNumber"
            stroke="var(--color-text-dim)"
            tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
            label={{ value: t("chart.lap"), position: "insideBottom", offset: -2, fill: "var(--color-text-dim)", fontSize: 11 }}
          />
          <YAxis
            reversed
            domain={[1, maxPosition]}
            allowDecimals={false}
            stroke="var(--color-text-dim)"
            tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
            tickFormatter={(v) => `P${v}`}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          {series.map((s) => (
            <Line
              key={s.code}
              type="stepAfter"
              dataKey={s.code}
              stroke={s.color}
              strokeWidth={1.75}
              strokeDasharray={s.dash ? "6 3" : undefined}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-(--color-text-dim) font-mono-data">
        {series.map((s) => (
          <span key={s.code} className="inline-flex items-center gap-1">
            <span className="w-2.5 h-1.5 rounded-sm shrink-0" style={{ background: s.color }} />
            {s.code}
          </span>
        ))}
      </div>
    </div>
  );
}
