// Бекенд віддає весь час у секундах (float). Форматування в м:сс.мс — на фронті.

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

/**
 * 93.66 → "1:33.660". Для < 60с — "0:33.660" (без опущеної хвилини, щоб
 * колонка не "стрибала" в таблиці).
 */
export function formatLapTime(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const sign = seconds < 0 ? "-" : "";
  const abs = Math.abs(seconds);
  const minutes = Math.floor(abs / 60);
  const secs = abs - minutes * 60;
  return `${sign}${minutes}:${pad(secs.toFixed(3), 6)}`;
}

/** Те саме, але без хвилин — для секторів, які рідко довші за хвилину. */
export function formatSector(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  return seconds.toFixed(3);
}

/** Відставання/дельта: 0.421 → "+0.421", -0.05 → "-0.050". */
export function formatDelta(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const sign = seconds >= 0 ? "+" : "-";
  return `${sign}${Math.abs(seconds).toFixed(3)}`;
}

/** Час сесії (секунди від старту) → "12:34" для осей графіків. */
export function formatClock(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${pad(secs)}`;
}

/** Швидкість у км/год — бекенд віддає число, лишається лише додати одиницю. */
export function formatSpeed(kph) {
  if (kph == null || Number.isNaN(kph)) return "—";
  return `${Math.round(kph)} км/год`;
}
