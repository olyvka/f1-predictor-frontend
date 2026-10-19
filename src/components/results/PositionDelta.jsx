import { positionDelta } from "../../utils/format";

// "Δ старт": GridPosition → Position, зелений/червоний/нейтральний.
export default function PositionDelta({ gridPosition, position }) {
  const result = positionDelta(gridPosition, position);
  if (!result) return <span className="text-(--color-text-dim)">—</span>;
  const color =
    result.delta > 0 ? "text-(--color-good)" : result.delta < 0 ? "text-(--color-danger)" : "text-(--color-text-dim)";
  return <span className={`font-semibold ${color}`}>{result.label}</span>;
}
