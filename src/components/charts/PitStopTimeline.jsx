import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { t } from "../../i18n";

// pitStops: [{code, lap, stop, duration, time_of_day}], order: [code, ...]
// у бажаному порядку рядків (звично — за фінішною позицією). Один рядок
// на пілота, крапка на кожен стоп; розмір крапки — тривалість, щоб
// повільний стоп впадав в око одразу, без читання таблиці.
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { code, lap, stop, duration, time_of_day } = payload[0].payload;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="font-semibold">
        {code} · {t("charts.stopN", { stop })}
      </p>
      <p className="text-(--color-text-dim)">
        {t("chart.lapLower", { lap })} · {time_of_day}
      </p>
      <p className="text-(--color-accent) font-semibold">{t("units.seconds", { value: duration.toFixed(3) })}</p>
    </div>
  );
}

export default function PitStopTimeline({ pitStops, order, height }) {
  if (!pitStops?.length || !order?.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("charts.noPitStops")}</p>;
  }

  const durations = pitStops.map((p) => p.duration);
  const min = Math.min(...durations);
  const max = Math.max(...durations);
  const radius = (d) => (max === min ? 6 : 4 + ((d - min) / (max - min)) * 8);

  const rowHeight = 22;
  const chartHeight = height || Math.max(120, 40 + order.length * rowHeight);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          dataKey="lap"
          allowDecimals={false}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          label={{ value: t("chart.lap"), position: "insideBottom", offset: -4, fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="code"
          domain={order}
          allowDuplicatedCategory={false}
          interval={0}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
          width={44}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter
          data={pitStops}
          fill="var(--color-accent)"
          shape={(props) => (
            <circle cx={props.cx} cy={props.cy} r={radius(props.payload.duration)} fill="var(--color-accent)" fillOpacity={0.75} />
          )}
          isAnimationActive={false}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
