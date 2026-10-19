import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// importance — сира вага з моделі (XGBoost gain/split-count тощо), шкала
// довільна й не нормована до 0..1 (бачили як 35, так і 304) — форматуємо
// як ціле число, а не нав'язуємо десяткові знаки.
function formatImportance(v) {
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

// data: [{ feature, label, importance }] — label уже українською з бекенду,
// жодного додаткового словника не треба. Сортуємо на всяк випадок — доку
// це вже "готові пари", але не гарантує порядок.
export default function FeatureImportanceChart({ data, height }) {
  const sorted = [...(data || [])].sort((a, b) => b.importance - a.importance);
  if (!sorted.length) {
    return <p className="text-sm text-(--color-text-dim)">Дані про важливість ознак відсутні.</p>;
  }

  const chartHeight = height || Math.max(120, 28 * sorted.length);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={sorted} layout="vertical" margin={{ top: 8, right: 24, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
          tickFormatter={formatImportance}
        />
        <YAxis
          type="category"
          dataKey="label"
          interval={0}
          width={140}
          stroke="var(--color-text-dim)"
          tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-2)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const { label, importance } = payload[0].payload;
            return (
              <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs font-mono-data">
                <p className="font-semibold">{label}</p>
                <p className="text-(--color-text-dim)">{formatImportance(importance)}</p>
              </div>
            );
          }}
        />
        <Bar dataKey="importance" fill="var(--color-accent)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  );
}
