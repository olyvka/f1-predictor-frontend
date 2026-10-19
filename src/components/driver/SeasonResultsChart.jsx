import { ResponsiveContainer, ComposedChart, Line, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

// Старт і фініш на кожному етапі сезону: видно, де пілот виграє позиції в
// гонці, а де втрачає. Сходи — окремими хрестиками внизу графіка.
function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  return (
    <div className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-xs">
      <p className="text-(--color-text-dim) mb-1">
        Етап {r.round} · {r.name}
      </p>
      <p className="font-mono-data">Старт: {r.grid ? `P${r.grid}` : "піт-лейн"}</p>
      <p className="font-mono-data">Фініш: {r.label === "DNF" || r.label === "DSQ" ? r.label : `P${r.label}`}</p>
    </div>
  );
}

function Cross({ cx, cy }) {
  if (cx == null || cy == null) return null;
  return (
    <path d={`M${cx - 4} ${cy - 4} L${cx + 4} ${cy + 4} M${cx + 4} ${cy - 4} L${cx - 4} ${cy + 4}`} stroke="var(--color-danger)" strokeWidth={2} />
  );
}

export default function SeasonResultsChart({ races, height = 260 }) {
  const field = Math.max(20, ...races.map((r) => r.grid || 0));
  const data = races.map((r) => {
    const out = r.label === "DNF" || r.label === "DSQ";
    return {
      ...r,
      start: r.grid || field, // старт з піт-лейну — з останнього місця
      finish: out ? null : Number(r.label),
      out: out ? field : null,
    };
  });

  return (
    <div className="flex flex-col gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="round" stroke="var(--color-text-dim)" tick={{ fill: "var(--color-text-dim)", fontSize: 11 }} />
          <YAxis
            reversed
            domain={[1, field]}
            allowDecimals={false}
            tickFormatter={(v) => `P${v}`}
            stroke="var(--color-text-dim)"
            tick={{ fill: "var(--color-text-dim)", fontSize: 11 }}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line dataKey="start" stroke="var(--color-text-dim)" strokeDasharray="4 3" strokeWidth={1.5} dot={{ r: 2.5 }} isAnimationActive={false} />
          <Line dataKey="finish" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3.5, fill: "var(--color-accent)" }} connectNulls isAnimationActive={false} />
          <Scatter dataKey="out" shape={<Cross />} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-x-4 text-[11px] text-(--color-text-dim)">
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="16" y2="3" stroke="var(--color-text-dim)" strokeWidth="1.5" strokeDasharray="4 2" />
          </svg>
          Старт
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="16" y2="3" stroke="var(--color-accent)" strokeWidth="2" />
          </svg>
          Фініш
        </span>
        <span className="inline-flex items-center gap-1.5 text-(--color-danger)">✕ Схід</span>
      </div>
    </div>
  );
}
