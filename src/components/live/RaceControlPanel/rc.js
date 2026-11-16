// Чисті функції стрічки race control (W7, L9): місцевий час траси, фільтри,
// вигляд чіпа прапора, ключі рядків. Без React та i18n - тестуються в Node.

import { rcFilterKind } from "../../../live/trackStatus";
import { carsMentioned } from "../../../live/store";

const pad = (v) => String(v).padStart(2, "0");

/**
 * gmt_offset сесії OpenF1 → хвилини від UTC або null.
 * "-03:00:00" → -180, "05:30:00" → 330, "+01:00" → 60. Невідоме/порожнє → null.
 */
export function parseGmtOffset(value) {
  if (value == null) return null;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value / 60) : null; // секунди
  const m = String(value).trim().match(/^([+-])?(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  const minutes = Number(m[2]) * 60 + Number(m[3]) + Math.round(Number(m[4] || 0) / 60);
  if (minutes > 14 * 60) return null;
  return m[1] === "-" ? -minutes : minutes;
}

/**
 * Мс epoch → годинник траси «HH:MM:SS» (як «TIMED AT» у повідомленнях FIA).
 * Без gmt_offset (старі записи) - UTC: {text, utc: true}, і UI додає «UTC».
 * null → null.
 */
export function trackClock(ms, gmtOffset) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  const off = parseGmtOffset(gmtOffset);
  const d = new Date(ms + (off ?? 0) * 60000);
  return { text: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`, utc: off == null };
}

/** Рядок для відображення: «14:03:17» або «17:03:17 UTC»; null → «—». */
export function formatTrackClock(ms, gmtOffset) {
  const c = trackClock(ms, gmtOffset);
  if (!c) return "—";
  return c.utc ? `${c.text} UTC` : c.text;
}

// --- фільтри ---

/** Фільтри стрічки (W7): Усі / Прапори / SC / Порушення / Інше. */
export const RC_FILTERS = ["all", "flag", "sc", "penalty", "other"];

/** Чи показувати повідомлення під фільтром. Категорію визначає rcFilterKind фундаменту. */
export function matchesFilter(msg, filter) {
  if (!msg) return false;
  if (!filter || filter === "all") return true;
  return rcFilterKind(msg) === filter;
}

/** Кількість повідомлень за категоріями: {all, flag, sc, penalty, other}. */
export function countByFilter(messages) {
  const out = { all: 0, flag: 0, sc: 0, penalty: 0, other: 0 };
  for (const m of messages || []) {
    out.all++;
    out[rcFilterKind(m)]++;
  }
  return out;
}

// --- чіп прапора (LIVE_UI_RESEARCH §5.3: колір + іконка + слово) ---

const FLAG_KINDS = {
  GREEN: "green",
  CLEAR: "clear",
  YELLOW: "yellow",
  "DOUBLE YELLOW": "double-yellow",
  BLUE: "blue",
  RED: "red",
  CHEQUERED: "chequered",
  "BLACK AND WHITE": "bw",
  BLACK: "black",
  "BLACK AND ORANGE": "black-orange",
};

/**
 * Вигляд чіпа: {kind, raw}. kind - ключ стилю й перекладу
 * (green, clear, yellow, double-yellow, blue, red, chequered, bw, black,
 * black-orange, sc, vsc, session, car, other, raw). raw - текст flag як є
 * для невідомих прапорів (показуємо без перекладу).
 */
export function flagMeta(msg) {
  const flag = msg?.flag ? String(msg.flag).toUpperCase() : null;
  if (msg?.category === "SafetyCar") {
    return { kind: /VIRTUAL/i.test(msg.message || "") ? "vsc" : "sc", raw: null };
  }
  if (flag) {
    const kind = FLAG_KINDS[flag];
    return kind ? { kind, raw: null } : { kind: "raw", raw: flag };
  }
  if (msg?.category === "SessionStatus") return { kind: "session", raw: null };
  if (msg?.category === "CarEvent") return { kind: "car", raw: null };
  return { kind: "other", raw: null };
}

// --- ключі та пілоти ---

/** Стабільні ключі рядків: час + текст (+ номер), повтори отримують суфікс. */
export function messageKeys(messages) {
  const seen = new Map();
  return (messages || []).map((m) => {
    const base = `${m.t ?? m.date ?? ""}|${m.driver_number ?? ""}|${m.message ?? ""}`;
    const n = seen.get(base) || 0;
    seen.set(base, n + 1);
    return n ? `${base}#${n}` : base;
  });
}

/** Чи стосується повідомлення пілота n: driver_number або «CAR 12 (ANT)» у тексті. */
export function mentionsDriver(msg, n) {
  if (n == null || !msg) return false;
  if (msg.driver_number != null && Number(msg.driver_number) === Number(n)) return true;
  return carsMentioned(msg.message).includes(Number(n));
}

// --- тости W16: нові піт-стопи й нове найшвидше коло ---

/**
 * Нові записи pit між двома знімками `state.pits` ({[n]: Pit[]}, copy-on-write).
 * Повертає [{driverNumber, pit}] за часом. prev == null → [] (базовий знімок).
 */
export function newPits(prev, next) {
  if (!prev || !next || prev === next) return [];
  const out = [];
  for (const [key, arr] of Object.entries(next)) {
    const old = prev[key];
    if (arr === old) continue;
    const known = new Set((old || []).map((p) => `${p.date}|${p.lap_number}`));
    for (const p of arr) if (!known.has(`${p.date}|${p.lap_number}`)) out.push({ driverNumber: Number(key), pit: p });
  }
  out.sort((a, b) => (a.pit.t ?? 0) - (b.pit.t ?? 0));
  return out;
}

/** Чи з'явилось нове найшвидше коло сесії (best.lap = {time, driverNumber, lapNumber}). */
export function isNewFastest(prev, next) {
  if (!next || next.time == null) return false;
  if (!prev || prev.time == null) return false; // перше відоме коло - не «рекорд», а базовий стан
  return next.time < prev.time - 1e-9;
}
