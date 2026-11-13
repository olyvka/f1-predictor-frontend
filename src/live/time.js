// Час у live-потоці. Усі моменти в сторі - мілісекунди epoch (UTC), щоб
// порівняння й інтерполяція були простими числами, а не рядками ISO.

/**
 * ISO-рядок OpenF1/бекенду → мс epoch або null.
 * OpenF1 дає мікросекунди ("…:01.257849+00:00"); частину браузерів це
 * плутає, тож обрізаємо дробову частину до мілісекунд.
 */
export function parseTime(iso) {
  if (iso == null) return null;
  if (typeof iso === "number") return Number.isFinite(iso) ? iso : null;
  const s = String(iso).replace(/(\.\d{3})\d+/, "$1");
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

/** Мс epoch → ISO UTC (для зворотної передачі в URL/логи). */
export function toIso(ms) {
  return ms == null ? null : new Date(ms).toISOString();
}

/** Секунди між двома моментами в мс (b − a) або null. */
export function secondsBetween(a, b) {
  return a == null || b == null ? null : (b - a) / 1000;
}
