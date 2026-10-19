import { teamHex } from "../../utils/constants";

// Кольорова крапка команди біля імені пілота — доповнює лівий бордер
// рядка/картки тим самим кольором команди, ближче до макета дизайну.
export default function DriverDot({ color }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: teamHex(color) }}
      aria-hidden="true"
    />
  );
}
