import Section from "./Section";

const pct = (rate) => `${Math.round(rate * 100)}%`;

// Історія траси станом до цього етапу. Групування на бекенді — за
// circuitId, тож "Styrian" і "Austrian" — одна траса.
export default function CircuitHistory({ history }) {
  if (!history || !history.races_held) return null;
  const { pole_conversion: pc } = history;

  return (
    <Section title="Історія траси">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex flex-col">
          <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">Гран-прі тут</span>
          <span className="font-mono-data text-xl font-bold">{history.races_held}</span>
          <span className="text-[11px] text-(--color-text-dim)">уперше у {history.first_gp_year}</span>
        </div>
        {pc && (
          <div className="flex flex-col" title="Частка гонок, які виграв пілот, що стартував першим">
            <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">Перемога з поулу</span>
            <span className="font-mono-data text-xl font-bold">{pct(pc.last_10.rate)}</span>
            <span className="text-[11px] text-(--color-text-dim)">
              за останні {pc.last_10.races} · {pct(pc.all_time.rate)} за всю історію
            </span>
          </div>
        )}
      </div>

      {history.most_wins?.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">Найбільше перемог</span>
          <ol className="text-sm flex flex-col">
            {history.most_wins.map((w) => (
              <li key={w.full_name} className="flex items-baseline justify-between gap-3">
                <span className="truncate">
                  <span className="font-semibold">{w.full_name}</span>
                  <span className="text-(--color-text-dim)"> · востаннє {w.last_win}</span>
                </span>
                <span className="font-mono-data font-semibold shrink-0">{w.wins}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {history.winners?.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">Останні переможці</span>
          <ol className="text-sm flex flex-col">
            {history.winners.map((w) => (
              <li
                key={`${w.year}-${w.round}`}
                className="flex items-baseline gap-3 py-1 border-t border-(--color-line) first:border-t-0"
              >
                <span className="font-mono-data text-(--color-text-dim) w-10 shrink-0">{w.year}</span>
                <span className="flex-1 min-w-0 truncate">
                  <span className="font-semibold">{w.full_name}</span>
                  <span className="text-(--color-text-dim)"> · {w.team}</span>
                </span>
                <span
                  className={`font-mono-data text-xs shrink-0 ${w.grid === 1 ? "text-(--color-accent)" : "text-(--color-text-dim)"}`}
                  title="Стартова позиція"
                >
                  {w.grid ? `зі старту P${w.grid}` : "з піт-лейну"}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Section>
  );
}
