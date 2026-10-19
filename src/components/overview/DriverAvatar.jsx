import { useState } from "react";
import { teamHex } from "../../utils/constants";

// Фото пілота в кільці кольору команди. Фото є лише для 2023+ (довідник
// driver_media на бекенді) — для старших сезонів і битих посилань
// показуємо код пілота на тлі кольору команди.
export default function DriverAvatar({ driver, size = 40 }) {
  const [broken, setBroken] = useState(false);
  const color = teamHex(driver?.team_color);
  const showPhoto = driver?.headshot_url && !broken;
  const initials = driver?.code || driver?.full_name?.split(" ").map((w) => w[0]).join("").slice(0, 3) || "?";

  return (
    <span
      className="relative inline-flex items-center justify-center rounded-full shrink-0 overflow-hidden bg-(--color-line)"
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${color}` }}
      aria-hidden="true"
    >
      {showPhoto ? (
        <img
          src={driver.headshot_url}
          alt=""
          className="w-full h-full object-cover object-top"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="font-mono-data font-bold text-(--color-text)" style={{ fontSize: size * 0.3 }}>
          {initials}
        </span>
      )}
    </span>
  );
}
