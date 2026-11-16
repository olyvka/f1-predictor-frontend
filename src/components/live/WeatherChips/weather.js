// Чисті функції погоди (W8, L10). Пороги - у часі сесії (clock − weather.t).

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Погода приходить ~1/хв: старша за 3 хв (час сесії) - приглушуємо. */
export const WEATHER_STALE_MS = 3 * 60 * 1000;
/** Тренд траси: Δ за 10 хв. */
export const TREND_WINDOW_MS = 10 * 60 * 1000;
/** Скільки історії тримати (з запасом на вікно тренду). */
export const HISTORY_MS = 15 * 60 * 1000;
/** Менші зміни не показуємо стрілкою (шум датчика). */
export const TREND_MIN_DELTA = 0.5;

/**
 * Кут стрілки вітру. wind_direction - звідки дме (метеорологічна конвенція),
 * стрілка показує, куди дме: dir + 180°. null → null.
 */
export function windArrowRotation(direction) {
  if (!isNum(direction)) return null;
  return (((direction + 180) % 360) + 360) % 360;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
/** Румб (8 напрямів), звідки дме: 0 → "N", 179 → "S". null → null. */
export function compassPoint(direction) {
  if (!isNum(direction)) return null;
  const d = ((direction % 360) + 360) % 360;
  return COMPASS[Math.round(d / 45) % 8];
}

/** Чи застаріла погода відносно годинника сесії. Без годинника - ні. */
export function isWeatherStale(weather, clock, thresholdMs = WEATHER_STALE_MS) {
  if (!weather || !isNum(weather.t) || !isNum(clock)) return false;
  return clock - weather.t > thresholdMs;
}

/** Дощ: rainfall > 0 (OpenF1 дає 0/1). null - невідомо. */
export function isRaining(weather) {
  if (!weather || weather.rainfall == null) return null;
  return Number(weather.rainfall) > 0;
}

/**
 * Додає семпл {t, v} до історії (новий масив). Повертає ту саму історію, якщо
 * семпл уже є. Час назад (перемотування) - історія починається заново.
 * Обрізає старше за HISTORY_MS від нового семпла.
 */
export function pushSample(history, t, v) {
  if (!isNum(t) || !isNum(v)) return history;
  const list = history || [];
  const last = list[list.length - 1];
  if (last && last.t === t) return list;
  if (last && t < last.t) return [{ t, v }];
  const out = list.filter((s) => t - s.t <= HISTORY_MS);
  out.push({ t, v });
  return out;
}

/**
 * Тренд за вікно: v(now) − v(now − 10 хв). Береться семпл, найближчий до
 * now − 10 хв, але не пізніше now − 8 хв (інакше історії замало → null).
 */
export function trendDelta(history, windowMs = TREND_WINDOW_MS) {
  if (!history || history.length < 2) return null;
  const last = history[history.length - 1];
  const target = last.t - windowMs;
  let best = null;
  for (const s of history) {
    if (s.t > last.t - windowMs * 0.8) break;
    if (!best || Math.abs(s.t - target) < Math.abs(best.t - target)) best = s;
  }
  if (!best) return null;
  return last.v - best.v;
}

/** Напрям тренду: "up" | "down" | null (|Δ| < порогу або немає даних). */
export function trendDirection(delta, minDelta = TREND_MIN_DELTA) {
  if (!isNum(delta) || Math.abs(delta) < minDelta) return null;
  return delta > 0 ? "up" : "down";
}
