import TeamBadge from "../results/TeamBadge";
import { t } from "../../i18n";

// Джерело валідних кодів пілотів (Abbreviation) для /api/laps, /api/driver,
// /api/compare — не текстове поле, а список з /api/drivers.
export default function DriverMultiSelect({ drivers, selected, onToggle }) {
  if (!drivers.length) {
    return <p className="text-sm text-(--color-text-dim)">{t("drivers.none")}</p>;
  }

  return (
    <div className="border border-(--color-line) rounded-md divide-y divide-(--color-line) overflow-hidden">
      {drivers.map((d) => {
        const checked = selected.includes(d.Abbreviation);
        return (
          <label
            key={d.DriverNumber ?? d.Abbreviation}
            className="flex items-center gap-3 px-4 py-2 text-sm cursor-pointer hover:bg-(--color-surface-hover) transition-colors"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggle(d.Abbreviation)}
              className="accent-(--color-accent)"
            />
            <span className="font-mono-data font-semibold w-12">{d.Abbreviation}</span>
            <span className="flex-1 min-w-0">
              <TeamBadge color={d.TeamColor} name={d.TeamName} />
            </span>
            <span className="text-xs text-(--color-text-dim) font-mono-data">
              {d.Position != null ? `P${d.Position}` : "—"}
            </span>
          </label>
        );
      })}
    </div>
  );
}
