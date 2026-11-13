// Коли replay доступний (L4): OpenF1 має позиції, телеметрію й race control
// лише з сезону 2023; сесія має вже завершитись.

export const FIRST_REPLAY_YEAR = 2023;
/** Запас після запланованого старту, після якого сесію вважаємо завершеною. */
export const SESSION_DONE_AFTER_MS = 3 * 3600 * 1000;

export function isReplayYear(year) {
  const y = Number(year);
  return Number.isInteger(y) && y >= FIRST_REPLAY_YEAR;
}

/** Чи сесія (ISO дата старту з /api/sessions) уже завершилась на момент now. */
export function isSessionFinished(dateIso, now = Date.now()) {
  const start = Date.parse(dateIso);
  return Number.isFinite(start) && start + SESSION_DONE_AFTER_MS < now;
}

/** Адреса екрана replay. */
export function replayPath(year, round, session, { offset, speed } = {}) {
  const q = new URLSearchParams();
  if (offset != null) q.set("offset", String(offset));
  if (speed != null) q.set("speed", String(speed));
  const qs = q.toString();
  return `/live/${year}/${round}/${session}${qs ? `?${qs}` : ""}`;
}
