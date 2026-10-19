import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";
import { formatLapTime } from "../../utils/time";
import { tyreColor } from "../../utils/constants";
import { timeDomain } from "../../utils/chartAxis";
import { t } from "../../i18n";

// laps: кола одного пілота — групуємо за Stint, вісь X — TyreLife (вік
// шини в колах), а не номер кола, щоб порівняти нахил "сідання" різних
// стінтів на спільній шкалі, незалежно від того, коли вони почались.
function buildStints(laps) {
  const byStint = new Map();
  for (const lap of laps) {
    if (lap.Stint == null || lap.TyreLife == null || lap.LapTime == null || lap.IsAccurate === false) continue;
    if (!byStint.has(lap.Stint)) byStint.set(lap.Stint, { stint: lap.Stint, compound: lap.Compound, points: [] });
    byStint.get(lap.Stint).points.push({ TyreLife: lap.TyreLife, LapTime: lap.LapTime });
  }
  return [...byStint.values()]
    .map((s) => ({ ...s, points: s.points.sort((a, b) => a.TyreLife - b.TyreLife) }))
    .sort((a, b) => a.stint - b.stint);
}

function buildMergedData(stints) {
  const ages = new Set();
  stints.forEach((s) => s.points.forEach((p) => ages.add(p.TyreLife)));
  const sorted = [...ages].sort((a, b) => a - b);
  return sorted.map((age) => {
    const row = { TyreLife: age };
    stints.forEach((s) => {
      const key = `stint${s.stint}`;
      const point = s.points.find((p) => p.TyreLife === age);
      row[key] = point ? point.LapTime : null;
    });
    return row;
  });
}

function ChartTooltip({ active, payload, label, stints }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
      <p className="text-(--color-text-dim) mb-1">{t("charts.tyreAge", { laps: label })}</p>
      {payload
        .filter((p) => p.value != null)
        .map((p) => {
          const stint = stints.find((s) => `stint${s.stint}` === p.dataKey);
          return (
            <p key={p.dataKey} style={{ color: p.color }}>
              {t("charts.stintN", { stint: stint?.stint })} ({stint?.compound}): {formatLapTime(p.value)}
            </p>
          );
        })}
    </div>
  );
}

export default function TyreDegradationChart({ laps, height = 260 }) {
  const stints = buildStints(laps || []);
  const data = buildMergedData(stints);

  if (!stints.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("charts.noDegradation")}</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="TyreLife"
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          label={{ value: t("charts.tyreAgeAxis"), position: "insideBottom", offset: -2, fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <YAxis
          reversed
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={formatLapTime}
          domain={timeDomain}
          width={64}
        />
        <Tooltip content={<ChartTooltip stints={stints} />} />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          payload={stints.map((s) => ({ value: `${t("charts.stintN", { stint: s.stint })} — ${s.compound}`, type: "line", color: tyreColor(s.compound) }))}
        />
        {stints.map((s) => (
          <Line
            key={s.stint}
            type="monotone"
            dataKey={`stint${s.stint}`}
            stroke={tyreColor(s.compound)}
            strokeWidth={2}
            dot={{ r: 2, fill: tyreColor(s.compound), strokeWidth: 0 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
