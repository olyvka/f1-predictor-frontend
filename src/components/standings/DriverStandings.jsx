import { Link } from "react-router-dom";
import { teamHex } from "../../utils/constants";
import DriverAvatar from "../overview/DriverAvatar";
import Badge from "../common/Badge";
import Section from "../overview/Section";
import FormChips from "./FormChips";
import PointsProgressChart from "./PointsProgressChart";
import { seriesColor, withTeammateDashes } from "../../utils/chartColors";

const CHART_TOP = 6;
const th = "text-left px-3 py-2 font-medium whitespace-nowrap";
const td = "px-3 py-2 whitespace-nowrap";

// Статус сезону над таблицею: фінальна чи проміжна, скільки очок ще в грі.
export function SeasonStatus({ progress }) {
  if (progress.final) {
    return <p className="text-sm text-(--color-text-dim)">Фінальна таблиця сезону.</p>;
  }
  return (
    <p className="text-sm text-(--color-text-dim)">
      Після етапу <span className="font-mono-data text-(--color-text)">{progress.completed_rounds}</span> з{" "}
      <span className="font-mono-data">{progress.total_rounds}</span> · ще можна набрати{" "}
      <span className="font-mono-data text-(--color-text)">{progress.max_remaining_points}</span> очок за
      пілота
    </p>
  );
}

function TitleBadge({ driver, final }) {
  if (final && driver.position === 1) return <Badge tone="good">Чемпіон</Badge>;
  // "У грі" лише для переслідувачів — лідер у грі за визначенням.
  if (!final && driver.position > 1 && driver.can_win_title) return <Badge tone="neutral">у грі за титул</Badge>;
  return null;
}

export default function DriverStandings({ progress, year }) {
  const { drivers, rounds, final } = progress;
  const chartSeries = withTeammateDashes(
    drivers.slice(0, CHART_TOP).map((d, i) => ({
      key: d.driver_ref,
      label: d.code || d.full_name,
      color: seriesColor(d.team_color, i),
      values: d.points_by_round,
    }))
  );

  return (
    <div className="flex flex-col gap-4">
      <SeasonStatus progress={progress} />

      <Section title={final ? "Як розгорталась боротьба за титул" : "Боротьба за титул"}>
        <PointsProgressChart rounds={rounds} series={chartSeries} />
      </Section>

      <div className="border border-(--color-line) rounded-md overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-(--color-surface) text-(--color-text-dim) text-xs uppercase tracking-wide">
            <tr>
              <th className={th}>Поз.</th>
              <th className={th}>Пілот</th>
              <th className={`${th} text-right`}>Очки</th>
              <th className={`${th} text-right hidden sm:table-cell`}>Відст.</th>
              <th className={`${th} text-right`} title="Перемоги">Перем.</th>
              <th className={`${th} text-right hidden md:table-cell`}>Подіуми</th>
              <th className={`${th} text-right hidden md:table-cell`} title="Перше місце в кваліфікації">
                1-й у квалі
              </th>
              <th className={`${th} text-right hidden md:table-cell`}>Сходи</th>
              <th className={`${th} hidden lg:table-cell`}>Форма</th>
            </tr>
          </thead>
          <tbody>
            {drivers.map((d) => (
              <tr
                key={d.driver_ref}
                className="border-t border-(--color-line) hover:bg-(--color-surface-hover) transition-colors"
                style={{ boxShadow: `inset 3px 0 0 ${teamHex(d.team_color)}` }}
              >
                <td className={`${td} font-mono-data text-(--color-text-dim)`}>{d.position}</td>
                <td className={td}>
                  <Link to={`/${year}/drivers/${d.driver_ref}`} className="flex items-center gap-2.5 group">
                    <DriverAvatar driver={d} size={28} />
                    <span className="flex flex-col min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold group-hover:text-(--color-accent) transition-colors">
                          {d.full_name}
                        </span>
                        <TitleBadge driver={d} final={final} />
                      </span>
                      <span className="text-xs text-(--color-text-dim)">{d.teams.join(" → ")}</span>
                    </span>
                  </Link>
                </td>
                <td className={`${td} text-right font-mono-data font-bold`}>{d.points}</td>
                <td className={`${td} text-right font-mono-data text-(--color-text-dim) hidden sm:table-cell`}>
                  {d.gap_to_leader ? `−${d.gap_to_leader}` : ""}
                </td>
                <td className={`${td} text-right font-mono-data`}>{d.wins || ""}</td>
                <td className={`${td} text-right font-mono-data hidden md:table-cell`}>{d.podiums || ""}</td>
                <td className={`${td} text-right font-mono-data hidden md:table-cell`}>{d.poles || ""}</td>
                <td className={`${td} text-right font-mono-data text-(--color-text-dim) hidden md:table-cell`}>
                  {d.dnfs || ""}
                </td>
                <td className={`${td} hidden lg:table-cell`}>
                  <FormChips form={d.form} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
