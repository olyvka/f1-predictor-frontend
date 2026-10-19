import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from "recharts";
import { t } from "../../i18n";

// laps — усе поле; рейтинг за максимальною SpeedST (класичний "спідтрап"
// з трансляцій), SpeedFL — довідково в підказці.
function buildData(laps) {
  const byDriver = new Map();
  for (const lap of laps || []) {
    if (!lap.Driver) continue;
    const current = byDriver.get(lap.Driver) || { code: lap.Driver, teamColor: lap.Team, st: 0, fl: 0 };
    if (lap.SpeedST != null && lap.SpeedST > current.st) current.st = lap.SpeedST;
    if (lap.SpeedFL != null && lap.SpeedFL > current.fl) current.fl = lap.SpeedFL;
    byDriver.set(lap.Driver, current);
  }
  return [...byDriver.values()]
    .filter((d) => d.st > 0)
    .sort((a, b) => b.st - a.st);
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const { code, st, fl } = payload[0].payload;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="font-semibold">{code}</p>
      <p>ST: {t("units.kph", { value: Math.round(st) })}</p>
      <p className="text-(--color-text-dim)">FL: {t("units.kph", { value: Math.round(fl) })}</p>
    </div>
  );
}

export default function SpeedTrapRanking({ laps, colorByCode, height }) {
  const data = buildData(laps);
  if (!data.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("chart.noSpeed")}</p>;
  }

  const chartHeight = height || Math.max(160, 28 * data.length);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          domain={["dataMin - 5", "dataMax + 5"]}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <YAxis
          type="category"
          dataKey="code"
          interval={0}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 10 }}
          width={40}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-surface-2)" }} />
        <Bar dataKey="st" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.code} fill={colorByCode?.get(d.code) ? `#${colorByCode.get(d.code)}` : "var(--color-accent)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
