// onRowClick/isSelected — опційно: рядок стає кнопкою вибору (напр. пілот,
// для якого показати пояснення прогнозу).
export default function ResultsTable({ title, rows, columns, emptyLabel, onRowClick, isSelected }) {
  return (
    <div className="border border-(--color-line) rounded-md overflow-hidden">
      {title && (
        <div className="bg-(--color-surface) px-4 py-2 border-b border-(--color-line) flex items-center justify-between">
          <h3 className="uppercase tracking-widest text-xs font-semibold text-(--color-accent)">
            {title}
          </h3>
        </div>
      )}

      {!rows.length ? (
        <p className="text-(--color-text-dim) text-sm px-4 py-6 text-center">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-(--color-text-dim) text-xs uppercase tracking-wide">
                {columns.map((col) => (
                  <th key={col.key} className="text-left px-4 py-2 font-medium whitespace-nowrap">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="font-mono-data">
              {rows.map((row, i) => (
                <tr
                  key={row.DriverNumber ?? row.Abbreviation ?? row.driver_id ?? i}
                  className={`border-t border-(--color-line) hover:bg-(--color-surface-hover) transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  } ${isSelected?.(row) ? "bg-(--color-surface-hover)" : ""}`}
                  style={
                    isSelected?.(row)
                      ? { boxShadow: "inset 3px 0 0 var(--color-accent)" }
                      : row.TeamColor
                        ? { borderLeft: `3px solid #${row.TeamColor}` }
                        : undefined
                  }
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onRowClick(row)) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-selected={onRowClick ? Boolean(isSelected?.(row)) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-2 whitespace-nowrap">
                      {col.render ? col.render(row) : row[col.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
