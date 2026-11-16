// Чисті функції оверлеїв з'єднання (W15, L14): який стан показати, «застарілі
// дані», підсумок на кінець сесії.

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Немає подій довше за це (час сесії) при відтворенні → чіп «Немає нових даних». */
export const STALE_MS = 10000;
/** Завантаження довше за це (реальні секунди) → «Довше, ніж зазвичай» + «Скасувати». */
export const LOADING_LONG_S = 15;

/**
 * Головна картка оверлею:
 *   "cancelled" - користувач скасував завантаження;
 *   "error"     - помилка (detail + «Спробувати ще»);
 *   "loading"   - session ще немає (підключення/завантаження);
 *   "lost"      - обрив, автопідключення з backoff (до session - по центру);
 *   "seeking"   - перемотування (старий кадр приглушений сторінкою);
 *   "ended"     - кінець сесії;
 *   null        - нічого.
 */
export function overlayView({ status, ready, seeking, ended, cancelled }) {
  if (cancelled) return "cancelled";
  if (status === "error") return "error";
  if (status === "lost") return "lost";
  if (seeking) return "seeking";
  if (!ready && (status === "idle" || status === "connecting" || status === "loading")) return "loading";
  if (status === "ended" || ended) return "ended";
  return null;
}

/**
 * Скільки секунд сесії немає жодної події, якщо це вже «застаріло» (> 10 с),
 * інакше null. Рахуємо лише під час відтворення (не на паузі, не під час
 * перемотування). Якщо подій ще не було - від replay.start.
 */
export function staleSeconds({ status, paused, seeking, clock, lastEventAt, replayStart, thresholdMs = STALE_MS }) {
  if (status !== "playing" || paused || seeking || !isNum(clock)) return null;
  const ref = isNum(lastEventAt) ? lastEventAt : replayStart;
  if (!isNum(ref)) return null;
  const age = clock - ref;
  return age > thresholdMs ? Math.floor(age / 1000) : null;
}

/**
 * Фінальна класифікація з рядків таблиці (useTower().rows, уже за позицією).
 * Гонка: відставання від лідера; кваліфікація/практика: найкраще коло.
 * Повертає [{position, driverNumber, acronym, color, gap, bestLap, isLeader}].
 */
export function finalClassification(rows, { limit = 10 } = {}) {
  const out = [];
  for (const r of rows || []) {
    if (r.position == null) continue;
    out.push({
      position: r.position,
      driverNumber: r.driverNumber,
      acronym: r.driver?.acronym ?? String(r.driverNumber),
      color: r.driver?.color ?? null,
      gap: r.gapToLeader ?? null,
      bestLap: r.bestLapTime ?? null,
      isLeader: !!r.isLeader,
    });
    if (out.length >= limit) break;
  }
  return out;
}
