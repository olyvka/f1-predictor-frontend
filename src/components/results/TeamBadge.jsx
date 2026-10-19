import { teamHex } from "../../utils/constants";

export default function TeamBadge({ color, name }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
        style={{ background: teamHex(color) }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}
