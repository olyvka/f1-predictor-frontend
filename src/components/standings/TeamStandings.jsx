import { Link } from "react-router-dom";
import { teamHex } from "../../utils/constants";
import Badge from "../common/Badge";
import Section from "../overview/Section";
import { SeasonStatus } from "./DriverStandings";
import PointsProgressChart from "./PointsProgressChart";
import { seriesColor } from "../../utils/chartColors";
import { t } from "../../i18n";

const CHART_TOP = 5;

// Внесок пілотів в очки команди: смужка, поділена пропорційно.
function Contribution({ team, year }) {
  const total = team.drivers.reduce((s, d) => s + d.points, 0);
  // Кольори команд є лише з 2023 — для старших сезонів смужка акцентна.
  const color = team.team_color ? teamHex(team.team_color) : "var(--color-accent)";
  if (!total) return <span className="text-xs text-(--color-text-dim)">{t("teams.noPoints")}</span>;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex h-2 rounded-full overflow-hidden bg-(--color-line)">
        {team.drivers.map((d, i) => (
          <span
            key={d.driver_ref}
            style={{ width: `${(d.points / total) * 100}%`, background: color, opacity: i === 0 ? 1 : i === 1 ? 0.55 : 0.3 }}
            title={`${d.full_name}: ${d.points}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 text-xs">
        {team.drivers.map((d) => (
          <Link key={d.driver_ref} to={`/${year}/drivers/${d.driver_ref}`} className="hover:text-(--color-accent) transition-colors">
            <span className="font-semibold">{d.code || d.full_name}</span>{" "}
            <span className="font-mono-data text-(--color-text-dim)">
              {d.points} · {Math.round((d.points / total) * 100)}%
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function TeamStandings({ progress, year }) {
  const { constructors, rounds, final } = progress;
  const series = constructors.slice(0, CHART_TOP).map((c, i) => ({
    key: String(c.constructor_id),
    label: c.team,
    color: seriesColor(c.team_color, i),
    values: c.points_by_round,
  }));

  return (
    <div className="flex flex-col gap-4">
      <SeasonStatus progress={progress} />

      <Section title={t("teams.title")}>
        <PointsProgressChart rounds={rounds} series={series} />
      </Section>

      <div className="flex flex-col divide-y divide-(--color-line) border border-(--color-line) rounded-md overflow-hidden">
        {constructors.map((c) => (
          <div
            key={c.constructor_id}
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] sm:grid-cols-[2rem_12rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 text-sm"
            style={{ boxShadow: `inset 3px 0 0 ${teamHex(c.team_color)}` }}
          >
            <span className="font-mono-data text-(--color-text-dim)">{c.position}</span>
            <span className="flex flex-col min-w-0">
              <span className="flex items-center gap-2">
                <span className="font-semibold truncate">{c.team}</span>
                {final && c.position === 1 && <Badge tone="good">{t("standingsTable.champion")}</Badge>}
              </span>
              <span className="text-xs text-(--color-text-dim) font-mono-data">
                {c.wins ? `${t("teams.wins", { count: c.wins })} · ` : ""}
                {t("teams.podiums", { count: c.podiums })}
              </span>
            </span>
            <span className="hidden sm:block">
              <Contribution team={c} year={year} />
            </span>
            <span className="text-right">
              <span className="block font-mono-data font-bold">{c.points}</span>
              <span className="block text-xs font-mono-data text-(--color-text-dim)">
                {c.gap_to_leader ? `−${c.gap_to_leader}` : ""}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
