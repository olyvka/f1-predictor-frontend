import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { useSetBreadcrumb } from "../hooks/useBreadcrumb";
import { nationalityLabel, teamHex, retirementLabel } from "../utils/constants";
import ErrorBanner from "../components/common/ErrorBanner";
import Loader from "../components/common/Loader";
import StatTile from "../components/common/StatTile";
import Badge from "../components/common/Badge";
import DriverAvatar from "../components/overview/DriverAvatar";
import Section from "../components/overview/Section";
import RatingCard from "../components/driver/RatingCard";
import TeammateDuel from "../components/driver/TeammateDuel";
import SeasonResultsChart from "../components/driver/SeasonResultsChart";

const th = "text-left px-3 py-2 font-medium whitespace-nowrap";
const td = "px-3 py-2 whitespace-nowrap";

function resultTone(label) {
  if (label === "DNF" || label === "DSQ") return "text-(--color-danger)";
  if (Number(label) <= 3) return "text-(--color-accent) font-bold";
  return "";
}

function SeasonRaces({ season, year }) {
  return (
    <div className="border border-(--color-line) rounded-md overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-(--color-surface) text-(--color-text-dim) text-xs uppercase tracking-wide">
          <tr>
            <th className={th}>Етап</th>
            <th className={th}>Гран-прі</th>
            <th className={`${th} text-right`}>Квалі</th>
            <th className={`${th} text-right`}>Старт</th>
            <th className={`${th} text-right`}>Фініш</th>
            <th className={`${th} text-right`}>Очки</th>
            <th className={`${th} text-right hidden sm:table-cell`}>Спринт</th>
            <th className={`${th} text-right hidden sm:table-cell`} title="Місце в чемпіонаті після етапу">
              Чемп.
            </th>
          </tr>
        </thead>
        <tbody className="font-mono-data">
          {season.races.map((r) => (
            <tr key={r.round} className="border-t border-(--color-line) hover:bg-(--color-surface-hover) transition-colors">
              <td className={`${td} text-(--color-text-dim)`}>{r.round}</td>
              <td className={`${td} font-sans`}>
                <Link
                  to={season.code ? `/${year}/${r.round}/R/driver/${season.code}` : `/${year}/${r.round}`}
                  className="hover:text-(--color-accent) transition-colors"
                >
                  {r.name}
                </Link>
                {season.teams.length > 1 && <span className="text-xs text-(--color-text-dim)"> · {r.team}</span>}
              </td>
              <td className={`${td} text-right`}>{r.quali_position ?? "—"}</td>
              <td className={`${td} text-right`}>{r.grid ? r.grid : "піт"}</td>
              <td className={`${td} text-right ${resultTone(r.label)}`} title={r.label === "DNF" ? retirementLabel(r.status) : undefined}>
                {r.label === "DNF" ? `DNF · ${retirementLabel(r.status)}` : r.label}
              </td>
              <td className={`${td} text-right`}>{r.points || ""}</td>
              <td className={`${td} text-right hidden sm:table-cell text-(--color-text-dim)`}>
                {r.sprint_position ? `P${r.sprint_position}${r.sprint_points ? ` · ${r.sprint_points}` : ""}` : ""}
              </td>
              <td className={`${td} text-right hidden sm:table-cell text-(--color-text-dim)`}>{r.championship_position ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Career({ career, year }) {
  const t = career.totals;
  return (
    <Section title="Кар'єра">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <StatTile label="Титули" value={t.titles} accent={t.titles > 0} />
        <StatTile label="Сезони" value={t.seasons} />
        <StatTile label="Старти" value={t.starts} />
        <StatTile label="Перемоги" value={t.wins} />
        <StatTile label="Подіуми" value={t.podiums} />
        <StatTile label="1-й у квалі" value={t.poles} />
        <StatTile label="Найшв. кола" value={t.fastest_laps ?? "—"} hint={t.fastest_laps == null ? "дані з 2004" : null} />
        <StatTile label="Очки" value={t.points} />
      </div>
      <p className="text-sm text-(--color-text-dim)">
        Дебют: {career.debut.name} {career.debut.year} · команди: {career.teams.join(", ")}
        {career.best_season &&
          ` · найкращий сезон: ${career.best_season.year} (P${career.best_season.position}, ${career.best_season.points} очк.)`}
      </p>
      <div className="border border-(--color-line) rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-(--color-surface) text-(--color-text-dim) text-xs uppercase tracking-wide">
            <tr>
              <th className={th}>Сезон</th>
              <th className={th}>Команда</th>
              <th className={`${th} text-right`}>Місце</th>
              <th className={`${th} text-right`}>Очки</th>
              <th className={`${th} text-right`}>Перем.</th>
              <th className={`${th} text-right hidden sm:table-cell`}>Подіуми</th>
              <th className={`${th} text-right hidden sm:table-cell`}>Старти</th>
            </tr>
          </thead>
          <tbody className="font-mono-data">
            {[...career.seasons].reverse().map((s) => (
              <tr
                key={s.year}
                className={`border-t border-(--color-line) hover:bg-(--color-surface-hover) transition-colors ${
                  s.year === Number(year) ? "bg-(--color-surface-2)" : ""
                }`}
              >
                <td className={td}>
                  <Link to={`/${s.year}/drivers/${career.driver_ref}`} className="hover:text-(--color-accent) transition-colors">
                    {s.year}
                  </Link>
                </td>
                <td className={`${td} font-sans`}>{s.teams.join(" → ")}</td>
                <td className={`${td} text-right ${s.position === 1 && s.final ? "text-(--color-accent) font-bold" : ""}`}>
                  {s.position ? `P${s.position}` : "—"}
                  {!s.final && <span className="text-(--color-text-dim)"> *</span>}
                </td>
                <td className={`${td} text-right`}>{s.points}</td>
                <td className={`${td} text-right`}>{s.wins || ""}</td>
                <td className={`${td} text-right hidden sm:table-cell`}>{s.podiums || ""}</td>
                <td className={`${td} text-right hidden sm:table-cell text-(--color-text-dim)`}>{s.starts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {career.seasons.some((s) => !s.final) && (
        <p className="text-[11px] text-(--color-text-dim)">* сезон ще триває</p>
      )}
    </Section>
  );
}

// Профіль пілота за сезон + кар'єра. Усе з CSV-датасету бекенду, миттєво.
export default function DriverProfilePage() {
  const { year, driverRef } = useParams();
  const navigate = useNavigate();
  const season = useApiQuery(() => api.getDriverSeason(year, driverRef), [year, driverRef]);
  const career = useApiQuery(() => api.getDriverCareer(driverRef), [driverRef]);
  const s = season.data;

  useSetBreadcrumb(
    [
      { label: year, to: `/${year}?tab=drivers` },
      { label: s?.full_name || driverRef },
    ],
    [year, driverRef, s?.full_name]
  );

  if (season.loading && !s) return <Loader label="Завантажуємо профіль пілота…" />;
  if (season.error) return <ErrorBanner message={season.error} onRetry={season.refetch} />;
  if (!s) return null;

  const champ = s.championship;
  const color = teamHex(s.team_color);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 pl-4" style={{ borderLeft: `4px solid ${color}` }}>
          <DriverAvatar driver={s} size={72} />
          <div className="flex flex-col gap-0.5">
            <h2 className="text-2xl font-bold uppercase">
              {s.full_name}
              {s.number && <span className="text-(--color-text-dim)"> #{s.number}</span>}
            </h2>
            <p className="text-sm text-(--color-text-dim)">
              {s.teams.join(" → ")} · {nationalityLabel(s.nationality)}
              {s.age && ` · ${s.age} р.`}
            </p>
            {champ.position && (
              <p className="flex items-center gap-2 text-sm">
                <span className="font-mono-data font-bold text-(--color-accent)">P{champ.position}</span>
                <span className="text-(--color-text-dim)">
                  у чемпіонаті {year} · {champ.points} очк.
                </span>
                {champ.position === 1 && career.data?.seasons.find((x) => x.year === Number(year))?.final && (
                  <Badge tone="good">Чемпіон</Badge>
                )}
              </p>
            )}
          </div>
        </div>
        <select
          value={year}
          onChange={(e) => navigate(`/${e.target.value}/drivers/${driverRef}`)}
          aria-label="Сезон"
          className="bg-(--color-surface) border border-(--color-line) rounded-md px-3 py-2 text-sm font-mono-data focus:outline-none focus:border-(--color-accent)"
        >
          {[...s.seasons].reverse().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <StatTile label="Перемоги" value={s.stats.wins} accent={s.stats.wins > 0} />
        <StatTile label="Подіуми" value={s.stats.podiums} hint={`очки в ${s.stats.points_finishes} з ${s.stats.starts} гонок`} />
        <StatTile label="1-й у квалі" value={s.stats.poles} hint="перше місце в кваліфікації" />
        <StatTile
          label="Сходи"
          value={s.stats.dnfs}
          hint={s.stats.dnfs ? `аварії/зіткнення: ${s.stats.dnfs_incident}` : "жодного"}
        />
        <StatTile label="Найкращий фініш" value={s.stats.best_finish ? `P${s.stats.best_finish}` : "—"} />
        <StatTile label="Сер. старт" value={s.stats.avg_grid ?? "—"} />
        <StatTile label="Сер. фініш" value={s.stats.avg_finish ?? "—"} hint="лише фініші" />
        <StatTile label="Очки у спринтах" value={s.stats.sprint_points} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 items-start">
        <RatingCard rating={s.rating} />
        <TeammateDuel driver={s} teammates={s.teammates} year={year} />
      </div>

      <Section title={`Сезон ${year} по етапах`}>
        <SeasonResultsChart races={s.races} />
        <SeasonRaces season={s} year={year} />
      </Section>

      {career.data && <Career career={career.data} year={year} />}
    </div>
  );
}
