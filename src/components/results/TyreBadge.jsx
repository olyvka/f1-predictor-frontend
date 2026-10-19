import { tyreColor, tyreLetter } from "../../utils/constants";

// Кольорове коло з літерою компаунда (S/M/H/I/W) замість квадратного
// свотча — компактніше в таблицях і картках.
export default function TyreBadge({ compound, size = 18 }) {
  if (!compound) return <span className="text-(--color-text-dim)">—</span>;
  return (
    <span
      title={compound}
      className="inline-flex items-center justify-center rounded-full font-bold text-black shrink-0"
      style={{ background: tyreColor(compound), width: size, height: size, fontSize: size * 0.55 }}
    >
      {tyreLetter(compound)}
    </span>
  );
}
