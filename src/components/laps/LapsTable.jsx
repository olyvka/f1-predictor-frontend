import { useMemo, useState } from "react";
import { formatLapTime, formatSector } from "../../utils/time";
import { decodeTrackStatus } from "../../utils/constants";
import TyreBadge from "../results/TyreBadge";

const PAGE_SIZE = 50;

// Повна таблиця кіл: сектори, швидкості, шина, позиція, прапорці
// (IsPersonalBest/Deleted/IsAccurate) — переюз на сторінці пілота, вкладці
// "Кола" сесії та в порівнянні. `null` рендериться як "—", а не ламає рядок.
export default function LapsTable({ laps, showDriver = false }) {
  const [page, setPage] = useState(0);

  const sorted = useMemo(
    () => [...laps].sort((a, b) => (a.LapNumber ?? 0) - (b.LapNumber ?? 0)),
    [laps]
  );
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  if (!laps.length) {
    return <p className="text-sm text-(--color-text-dim)">Кола відсутні.</p>;
  }

  return (
    <div className="border border-(--color-line) rounded-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-(--color-text-dim) uppercase tracking-wide">
              {showDriver && <th className="text-left px-3 py-2 font-medium">Пілот</th>}
              <th className="text-left px-3 py-2 font-medium">Коло</th>
              <th className="text-left px-3 py-2 font-medium">Час</th>
              <th className="text-left px-3 py-2 font-medium">S1</th>
              <th className="text-left px-3 py-2 font-medium">S2</th>
              <th className="text-left px-3 py-2 font-medium">S3</th>
              <th className="text-left px-3 py-2 font-medium">SpI1</th>
              <th className="text-left px-3 py-2 font-medium">SpI2</th>
              <th className="text-left px-3 py-2 font-medium">SpFL</th>
              <th className="text-left px-3 py-2 font-medium">SpST</th>
              <th className="text-left px-3 py-2 font-medium">Шина</th>
              <th className="text-left px-3 py-2 font-medium">Життя</th>
              <th className="text-left px-3 py-2 font-medium">Поз.</th>
              <th className="text-left px-3 py-2 font-medium">Стан траси</th>
            </tr>
          </thead>
          <tbody className="font-mono-data">
            {pageRows.map((lap, i) => {
              const inaccurate = lap.IsAccurate === false;
              const deleted = !!lap.Deleted;
              return (
                <tr
                  key={`${lap.Driver ?? ""}-${lap.LapNumber ?? i}`}
                  className={`border-t border-(--color-line) hover:bg-(--color-surface-hover) transition-colors ${
                    inaccurate ? "opacity-40" : ""
                  }`}
                  title={deleted ? lap.DeletedReason || "Коло видалено" : undefined}
                >
                  {showDriver && <td className="px-3 py-1.5">{lap.Driver ?? "—"}</td>}
                  <td className="px-3 py-1.5">{lap.LapNumber ?? "—"}</td>
                  <td
                    className={`px-3 py-1.5 ${deleted ? "line-through text-(--color-danger)" : ""} ${
                      lap.IsPersonalBest ? "text-(--color-accent) font-semibold" : ""
                    }`}
                  >
                    {formatLapTime(lap.LapTime)}
                  </td>
                  <td className="px-3 py-1.5">{formatSector(lap.Sector1Time)}</td>
                  <td className="px-3 py-1.5">{formatSector(lap.Sector2Time)}</td>
                  <td className="px-3 py-1.5">{formatSector(lap.Sector3Time)}</td>
                  <td className="px-3 py-1.5">{lap.SpeedI1 ?? "—"}</td>
                  <td className="px-3 py-1.5">{lap.SpeedI2 ?? "—"}</td>
                  <td className="px-3 py-1.5">{lap.SpeedFL ?? "—"}</td>
                  <td className="px-3 py-1.5">{lap.SpeedST ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <TyreBadge compound={lap.Compound} size={16} />
                      {lap.FreshTyre === false ? "б/в" : ""}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">{lap.TyreLife ?? "—"}</td>
                  <td className="px-3 py-1.5">{lap.Position ?? "—"}</td>
                  <td className="px-3 py-1.5">
                    {decodeTrackStatus(lap.TrackStatus).join(", ") || "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-(--color-line) text-xs text-(--color-text-dim)">
          <button
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
            className="disabled:opacity-30 hover:text-(--color-accent)"
          >
            ← Попередні
          </button>
          <span>
            {page + 1} / {pageCount}
          </span>
          <button
            disabled={page >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
            className="disabled:opacity-30 hover:text-(--color-accent)"
          >
            Наступні →
          </button>
        </div>
      )}
    </div>
  );
}
