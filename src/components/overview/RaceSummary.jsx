import { formatLapTime, formatSpeed } from "../../utils/time";
import { teamHex, retirementLabel } from "../../utils/constants";
import DriverAvatar from "./DriverAvatar";
import Section from "./Section";

const PLACE_LABELS = { 1: "P1", 2: "P2", 3: "P3" };

function PodiumCard({ driver, winner }) {
  return (
    <div
      className="border border-(--color-line) bg-(--color-surface) rounded-md p-3 flex items-center gap-3 min-w-0"
      style={{ borderTop: `3px solid ${teamHex(driver.team_color)}` }}
    >
      <DriverAvatar driver={driver} size={winner ? 52 : 44} />
      <div className="flex flex-col min-w-0">
        <span className={`font-mono-data text-xs font-bold ${winner ? "text-(--color-accent)" : "text-(--color-text-dim)"}`}>
          {PLACE_LABELS[driver.position]}
        </span>
        <span className="font-semibold truncate">{driver.full_name}</span>
        <span className="text-xs text-(--color-text-dim) truncate">{driver.team}</span>
        <span className="font-mono-data text-xs mt-0.5">{driver.time_display || driver.status}</span>
      </div>
    </div>
  );
}

// Один факт з пілотом: "Поул — Verstappen 1:27.241".
function DriverFact({ label, driver, value, hint }) {
  if (!driver) return null;
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <DriverAvatar driver={driver} size={32} />
      <div className="flex flex-col min-w-0">
        <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">{label}</span>
        <span className="text-sm truncate">
          <span className="font-semibold">{driver.code || driver.full_name}</span>
          {value && <span className="font-mono-data text-(--color-text-dim)"> · {value}</span>}
        </span>
        {hint && <span className="text-[11px] text-(--color-text-dim)">{hint}</span>}
      </div>
    </div>
  );
}

function gainerHint(g) {
  const from = g.pit_lane_start ? "з піт-лейну" : `з P${g.grid}`;
  return `${from} на P${g.position}`;
}

// Підсумок однієї гонки (основної чи спринту) — подіум і ключові факти.
function RaceBlock({ race }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {race.podium.map((d) => (
          <PodiumCard key={d.position} driver={d} winner={d.position === 1} />
        ))}
      </div>

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 items-start">
        <DriverFact
          label="Поул"
          driver={race.pole}
          value={race.pole?.time != null ? formatLapTime(race.pole.time) : null}
          // У спринту немає окремої кваліфікації в датасеті — це той, хто стартував першим.
          hint={race.pole && race.pole.time == null ? "стартував першим" : null}
        />
        <DriverFact
          label="Найшвидше коло"
          driver={race.fastest_lap}
          value={race.fastest_lap ? formatLapTime(race.fastest_lap.time) : null}
          hint={
            race.fastest_lap
              ? [`коло ${race.fastest_lap.lap}`, race.fastest_lap.avg_speed && formatSpeed(race.fastest_lap.avg_speed)]
                  .filter(Boolean)
                  .join(" · ")
              : null
          }
        />
        <DriverFact
          label="Герой гонки"
          driver={race.biggest_gainer?.gained > 0 ? race.biggest_gainer : null}
          value={race.biggest_gainer ? `+${race.biggest_gainer.gained}` : null}
          hint={race.biggest_gainer ? gainerHint(race.biggest_gainer) : null}
        />
        <div className="flex flex-col min-w-0">
          <span className="text-[11px] uppercase tracking-widest text-(--color-text-dim)">
            Сходи · {race.dnf_count}
          </span>
          {race.dnfs.length ? (
            <ul className="text-sm flex flex-col">
              {race.dnfs.map((d) => (
                <li key={d.code || d.full_name} className="truncate" title={d.full_name}>
                  <span className="font-semibold">{d.code || d.full_name}</span>
                  <span className="text-(--color-text-dim)">
                    {" "}
                    · {retirementLabel(d.status)}
                    {d.laps != null && `, коло ${d.laps}`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-(--color-text-dim)">усі фінішували</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RaceSummary({ summary }) {
  return (
    <Section title={`Підсумок гонки · ${summary.laps} кіл`}>
      <RaceBlock race={summary} />
      {summary.sprint && (
        <div className="flex flex-col gap-3 pt-3 border-t border-(--color-line)">
          <h4 className="text-xs uppercase tracking-widest font-semibold text-(--color-text-dim)">
            Спринт · {summary.sprint.laps} кіл
          </h4>
          <RaceBlock race={summary.sprint} />
        </div>
      )}
    </Section>
  );
}
