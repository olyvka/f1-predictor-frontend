import { useState } from "react";
import { teamHex } from "../../utils/constants";
import Section from "./Section";

const TOP = 5;

// delta_position > 0 — піднявся. null на першому етапі сезону.
function Movement({ delta }) {
  if (delta == null) return <span className="w-8" />;
  if (delta === 0) return <span className="w-8 font-mono-data text-(--color-text-dim)">=</span>;
  const up = delta > 0;
  return (
    <span
      className={`w-8 font-mono-data ${up ? "text-(--color-good)" : "text-(--color-danger)"}`}
      title={up ? `Піднявся на ${delta}` : `Опустився на ${-delta}`}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}

const tabBase = "px-2.5 py-1 text-[11px] uppercase tracking-wide rounded-full transition-colors";

export default function StandingsSnapshot({ standings, year }) {
  const [tab, setTab] = useState("drivers");
  const rows = (tab === "drivers" ? standings.drivers : standings.constructors).slice(0, TOP);
  const future = standings.as_of_round !== standings.requested_round;
  // У рядках команд бекенд не віддає team_color — беремо з пілотів тієї ж команди.
  const colorByTeam = new Map(standings.drivers.filter((d) => d.team_color).map((d) => [d.team, d.team_color]));

  return (
    <Section
      title={future ? "Чемпіонат перед етапом" : "Чемпіонат після етапу"}
      action={{ to: `/${year}?tab=${tab === "drivers" ? "drivers" : "teams"}`, label: "Уся таблиця" }}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1" role="tablist">
          {[
            ["drivers", "Пілоти"],
            ["constructors", "Команди"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`${tabBase} ${
                tab === id
                  ? "bg-(--color-accent) text-white font-semibold"
                  : "text-(--color-text-dim) hover:text-(--color-text) hover:bg-(--color-surface)"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {future && (
          <span className="text-[11px] text-(--color-text-dim)">станом на етап {standings.as_of_round}</span>
        )}
      </div>

      <ol className="flex flex-col text-sm">
        {rows.map((r) => (
          <li
            key={r.driver_id ?? r.constructor_id}
            className="flex items-center gap-3 py-1.5 border-t border-(--color-line) first:border-t-0"
          >
            <span className="w-5 text-right font-mono-data text-(--color-text-dim)">{r.position}</span>
            <span
              className="w-1 h-4 rounded-sm shrink-0"
              style={{ background: teamHex(r.team_color || colorByTeam.get(r.team)) }}
              aria-hidden="true"
            />
            <span className="flex-1 min-w-0 truncate">
              <span className="font-semibold">{r.full_name || r.team}</span>
              {r.full_name && <span className="text-(--color-text-dim)"> · {r.team}</span>}
            </span>
            {/* На майбутньому етапі дельта — зміна вже на попередньому, тож не плутаємо. */}
            {!future && <Movement delta={r.delta_position} />}
            <span className="w-14 text-right font-mono-data font-semibold">{r.points}</span>
            <span className="w-12 text-right font-mono-data text-(--color-text-dim)">
              {r.gap_to_leader ? `−${r.gap_to_leader}` : ""}
            </span>
          </li>
        ))}
      </ol>
    </Section>
  );
}
