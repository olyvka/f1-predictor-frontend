// Шини: метадані компаундів і вік комплекту ([клієнт] у LIVE_UI_RESEARCH §5.4, W3).

/** Компаунд → літера, CSS-токен кольору (src/index.css, блок «Live») і ключ i18n. */
export const COMPOUNDS = {
  SOFT: { letter: "S", color: "var(--color-tyre-soft)", key: "soft" },
  MEDIUM: { letter: "M", color: "var(--color-tyre-medium)", key: "medium" },
  HARD: { letter: "H", color: "var(--color-tyre-hard)", key: "hard" },
  INTERMEDIATE: { letter: "I", color: "var(--color-tyre-inter)", key: "intermediate" },
  WET: { letter: "W", color: "var(--color-tyre-wet)", key: "wet" },
};
const UNKNOWN = { letter: "?", color: "var(--color-tyre-unknown)", key: "unknown" };

/** Метадані компаунда; невідомий/null → «?» сірим. Підпис: t(`live.common.tyre.${key}`). */
export function compoundMeta(compound) {
  return COMPOUNDS[String(compound || "").toUpperCase()] || UNKNOWN;
}

/**
 * Вік комплекту в колах: tyre_age_at_start + max(0, L − lap_start + 1), де
 * L - останнє завершене коло пілота (0/null, якщо кіл ще немає).
 * null, якщо стінта немає.
 */
export function tyreAge(stint, lastCompletedLap) {
  if (!stint) return null;
  const base = Number.isFinite(stint.tyre_age_at_start) ? stint.tyre_age_at_start : 0;
  if (!Number.isFinite(stint.lap_start)) return base;
  const L = Number.isFinite(lastCompletedLap) ? lastCompletedLap : 0;
  return base + Math.max(0, L - stint.lap_start + 1);
}

/** Вживаний комплект: tyre_age_at_start > 0 (бейдж з пунктирним кільцем). */
export function isUsedSet(stint) {
  return !!stint && Number.isFinite(stint.tyre_age_at_start) && stint.tyre_age_at_start > 0;
}

/** Поточний стінт = з найбільшим stint_number (масив стінтів пілота). */
export function currentStint(stints) {
  if (!stints || !stints.length) return null;
  let best = stints[0];
  for (const s of stints) if ((s.stint_number ?? 0) > (best.stint_number ?? 0)) best = s;
  return best;
}
