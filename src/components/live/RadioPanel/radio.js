// Чисті функції панелі командного радіо (тестуються окремо).

/** Фільтри списку: усі кліпи / лише пілот у фокусі / лише непрослухані. */
export const RADIO_FILTERS = ["all", "focus", "unheard"];

export function matchesRadioFilter(clip, filter, { focus, heard }) {
  if (filter === "focus") return focus != null && clip.driver_number === focus;
  if (filter === "unheard") return !heard[clip.recording_url];
  return true;
}

/**
 * Номер кола пілота в момент кліпу: останнє коло, що почалось не пізніше t.
 * laps - {[n]: Lap[]} зі стору (date_start - ISO-рядок, t - мс).
 */
export function lapAt(laps, driverNumber, t) {
  const arr = laps?.[driverNumber];
  if (!arr?.length || t == null) return null;
  let lap = null;
  for (const l of arr) {
    const start = l.date_start ? Date.parse(l.date_start) : null;
    if (start != null && start <= t) lap = l.lap_number;
  }
  return lap;
}

/** Кількість непрослуханих серед кліпів. */
export function unheardCount(clips, heard) {
  let n = 0;
  for (const c of clips) if (!heard[c.recording_url]) n++;
  return n;
}
