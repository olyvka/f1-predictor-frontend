import { Link } from "react-router-dom";
import DriverDot from "./DriverDot";

// Фото пілота з фолбеком-заглушкою (буває недоступне для старих сезонів) +
// кольорова крапка команди перед кодом.
export default function DriverCell({ code, headshotUrl, teamColor, to }) {
  const content = (
    <span className="inline-flex items-center gap-2">
      {headshotUrl ? (
        <img
          src={headshotUrl}
          alt=""
          className="w-6 h-6 rounded-full object-cover bg-(--color-line) shrink-0"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      ) : (
        <span className="w-6 h-6 rounded-full bg-(--color-line) shrink-0" />
      )}
      {teamColor !== undefined && <DriverDot color={teamColor} />}
      <span className="font-semibold">{code || "—"}</span>
    </span>
  );

  if (!to) return content;
  return (
    <Link to={to} className="hover:text-(--color-accent) transition-colors">
      {content}
    </Link>
  );
}
