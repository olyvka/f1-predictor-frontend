import { t } from "../../i18n";

// SVG-контур траси з public/circuits (див. utils/circuits.js).
// variant="thumb" — мініатюра в списку етапів: лише лінія.
// variant="full" — картка етапу: номери поворотів і лінія старт/фініш.
// Товщина ліній задана в пікселях (non-scaling-stroke), тож однакова
// незалежно від розміру траси у viewBox.
export default function CircuitMap({ outline, variant = "full", className = "" }) {
  if (!outline) return null;
  const full = variant === "full";
  const { start } = outline;

  return (
    <svg
      viewBox={outline.viewBox}
      className={className}
      // Мініатюра в списку — декор поруч із назвою етапу, читачу екрана
      // вона нічого не додає; повна схема — підписане зображення.
      {...(full ? { role: "img", "aria-label": t("circuit.mapLabel", { name: outline.circuit }) } : { "aria-hidden": true })}
      preserveAspectRatio="xMidYMid meet"
    >
      {full && (
        <path
          d={outline.path}
          fill="none"
          stroke="var(--color-line)"
          strokeWidth={9}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={outline.path}
        fill="none"
        stroke={full ? "var(--color-accent)" : "currentColor"}
        strokeWidth={full ? 3 : 1.75}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {full && (
        <>
          {/* Лінія старт/фініш — коротка поперечна риска в першій точці кола. */}
          <line
            x1={-22}
            y1={0}
            x2={22}
            y2={0}
            transform={`translate(${start.x} ${start.y}) rotate(${start.angle + 90})`}
            stroke="var(--color-text)"
            strokeWidth={3}
            vectorEffect="non-scaling-stroke"
          />
          {outline.corners.map((c) => (
            <text
              key={c.n}
              x={c.lx}
              y={c.ly}
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--color-text-dim)"
              fontSize={30}
              className="font-mono-data"
            >
              {c.n}
            </text>
          ))}
        </>
      )}
    </svg>
  );
}
