// Дати з бекенду — ISO-рядки без адаптації під часовий пояс користувача;
// конвертація в локальний час виконується тут через Intl. Мова — українська,
// як і весь інтерфейс (часовий пояс лишається користувача).

const dateTimeFormatter = new Intl.DateTimeFormat("uk-UA", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return dateTimeFormatter.format(d);
}

export function isFuture(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() > Date.now();
}

/**
 * Категорія сесії за кодом — визначає набір колонок результатів і те, яка
 * вкладка є "головною" (для practice це не /api/results, а найкращі кола).
 */
export function classifySession(code) {
  if (!code) return "race";
  if (code.startsWith("FP")) return "practice";
  if (code === "Q" || code === "SQ") return "qualifying";
  // R (Race), S (Sprint) — і будь-що інше історичне трактуємо як race-подібне.
  return "race";
}

export function isSprintWeekend(eventFormat) {
  return eventFormat === "sprint_qualifying";
}

// /api/csv/results підтримує лише R/S/Q (не SQ, не практики — Ergast не
// веде результатів практик і окремо не покриває sprint qualifying).
const CSV_FAST_MODE_SESSIONS = new Set(["R", "S", "Q"]);

export function supportsCsvFastMode(session) {
  return CSV_FAST_MODE_SESSIONS.has(session);
}

// `SessionXDateUtc` доходить без явного зсуву (не завжди з "Z"), хоча
// зветься "Utc" — форсуємо UTC-парсинг, якщо зсуву не видно в рядку.
export function parseUtc(iso) {
  if (!iso) return null;
  const hasOffset = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso);
  const d = new Date(hasOffset ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Етап вважається завершеним, якщо остання відома сесія вже в минулому. */
export function isEventCompleted(race) {
  const dates = [1, 2, 3, 4, 5]
    .map((n) => parseUtc(race[`Session${n}DateUtc`]))
    .filter(Boolean);
  if (!dates.length) return false;
  return Math.max(...dates.map((d) => d.getTime())) < Date.now();
}

/**
 * Зміна позиції відносно старту: GridPosition − Position (додатнє —
 * пілот піднявся). `null`, якщо якесь із значень відсутнє (поза гонкою).
 */
export function positionDelta(gridPosition, position) {
  if (gridPosition == null || position == null) return null;
  const delta = gridPosition - position;
  return { delta, label: delta === 0 ? "=" : delta > 0 ? `+${delta}` : `${delta}` };
}

/** Мілісекунди → { days, hours, minutes, seconds } для таймерів відліку. */
export function splitDuration(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

// Назва сесії в календарі FastF1 → короткий код, як у табах етапу.
const SESSION_CODES = {
  "Practice 1": "FP1",
  "Practice 2": "FP2",
  "Practice 3": "FP3",
  Qualifying: "Q",
  "Sprint Qualifying": "SQ",
  "Sprint Shootout": "SQ",
  Sprint: "S",
  Race: "R",
};

/** Сесії етапу з рядка /api/races: [{ code, name, date_utc, at: Date }] у хронологічному порядку. */
export function raceSessions(race) {
  return [1, 2, 3, 4, 5]
    .map((n) => ({ name: race[`Session${n}`], date_utc: race[`Session${n}DateUtc`] }))
    .filter((s) => s.name && s.date_utc)
    .map((s) => ({ ...s, code: SESSION_CODES[s.name] || s.name, at: parseUtc(s.date_utc) }))
    .filter((s) => s.at)
    .sort((a, b) => a.at - b.at);
}

const dayMonth = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "short" });
const dayOnly = new Intl.DateTimeFormat("uk-UA", { day: "numeric" });
const timeOnly = new Intl.DateTimeFormat("uk-UA", { hour: "2-digit", minute: "2-digit" });

/**
 * Дати вікенду: "23–25 жовт." або "30 жовт. – 1 лист.". EventDate з бекенду —
 * лише дата без часу (тому раніше всюди було "00:00"), тож беремо межі з
 * розкладу сесій; без розкладу — саму дату гонки.
 */
export function weekendRange(race) {
  const sessions = raceSessions(race);
  if (!sessions.length) {
    const d = new Date(race.EventDate);
    return Number.isNaN(d.getTime()) ? "—" : dayMonth.format(d);
  }
  const first = sessions[0].at;
  const last = sessions[sessions.length - 1].at;
  if (first.toDateString() === last.toDateString()) return dayMonth.format(last);
  if (first.getMonth() === last.getMonth()) return `${dayOnly.format(first)}–${dayMonth.format(last)}`;
  return `${dayMonth.format(first)} – ${dayMonth.format(last)}`;
}

/** Час старту гонки в часовому поясі користувача ("21:00") або null. */
export function raceStartTime(race) {
  const r = raceSessions(race).find((s) => s.code === "R");
  return r ? timeOnly.format(r.at) : null;
}

/** "через 3 дн." / "через 5 год" / "зараз" — короткий відлік для списків. */
export function shortCountdown(ms) {
  if (ms <= 0) return "зараз";
  const { days, hours, minutes } = splitDuration(ms);
  if (days > 0) return `через ${days} дн.`;
  if (hours > 0) return `через ${hours} год`;
  return `через ${minutes} хв`;
}
