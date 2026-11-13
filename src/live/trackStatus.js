// Статус траси з повідомлень race control (W2 у LIVE_UI_RESEARCH, L9).
// Згортка інкрементальна: reduceTrackStatus(стан, повідомлення) - тож стор
// не перебирає весь лог на кожен батч, а лог можна обрізати до 200 записів.
//
// Правила (перевірено на даних OpenF1 2025-2026):
//   - category "SafetyCar": «VIRTUAL SAFETY CAR …» → VSC, інше → SC;
//     «… DEPLOYED» → phase DEPLOYED, «… ENDING» / «… IN THIS LAP» → ENDING,
//     невідомий текст → phase null, текст показується як є;
//   - scope "Track": GREEN → CLEAR (знімає все, включно з RED і жовтими
//     секторами); CLEAR («TRACK CLEAR») знімає SC/VSC/жовті, але НЕ червоний
//     прапор (у кваліфікації Бразилії 2026 «TRACK CLEAR» прийшов посеред
//     зупинки під червоним); RED, CHEQUERED, YELLOW, DOUBLE YELLOW - як є;
//   - scope "Sector" + sector: активні жовті = сектори, де останній прапор
//     YELLOW / DOUBLE YELLOW (CLEAR / GREEN знімає);
//   - category "SessionStatus" «SESSION STARTED|RESUMED» знімає RED.
// Повідомлення без цих ознак стан не змінюють.

import { parseTime } from "./time";

/** Стани банера. CLEAR - траса чиста (банер не показуємо, лише чіп на ~5 с). */
export const TRACK_STATES = ["CLEAR", "YELLOW", "DOUBLE_YELLOW", "SC", "VSC", "RED", "CHEQUERED"];

export function initialTrackStatus() {
  return {
    state: null, // null - ще не було жодного релевантного повідомлення
    phase: null, // "DEPLOYED" | "ENDING" | null (лише для SC/VSC)
    message: null, // текст повідомлення, що встановив state (без перекладу)
    date: null, // мс epoch цього повідомлення
    lap: null, // lap_number цього повідомлення
    sectors: [], // активні жовті сектори: [{sector, flag: "YELLOW"|"DOUBLE YELLOW", date}], за номером
    clearedAt: null, // мс epoch, коли state востаннє став CLEAR (для чіпа «Зелений» 5 с)
  };
}

const YELLOWS = new Set(["YELLOW", "DOUBLE YELLOW"]);

function withState(prev, state, msg, extra = {}) {
  const date = msg.t ?? parseTime(msg.date);
  return {
    ...prev,
    state,
    phase: null,
    message: msg.message ?? null,
    date,
    lap: msg.lap_number ?? null,
    clearedAt: state === "CLEAR" ? date : prev.clearedAt,
    ...extra,
  };
}

/** Один крок згортки. Повертає новий об'єкт, якщо стан змінився, інакше той самий. */
export function reduceTrackStatus(prev, msg) {
  if (!msg) return prev;
  const category = msg.category;
  const flag = msg.flag ? String(msg.flag).toUpperCase() : null;
  const text = String(msg.message || "").toUpperCase();

  if (category === "SafetyCar") {
    const kind = /VIRTUAL/.test(text) ? "VSC" : "SC";
    const phase = /DEPLOYED/.test(text) ? "DEPLOYED" : /ENDING|IN THIS LAP/.test(text) ? "ENDING" : null;
    return { ...withState(prev, kind, msg), phase };
  }

  if (category === "SessionStatus" && prev.state === "RED" && /SESSION (STARTED|RESUMED)/.test(text)) {
    return withState(prev, "CLEAR", msg, { sectors: [] });
  }

  if (msg.scope === "Track" && flag) {
    if (flag === "GREEN") return withState(prev, "CLEAR", msg, { sectors: [] });
    if (flag === "CLEAR") {
      if (prev.state === "RED") return prev;
      return withState(prev, "CLEAR", msg, { sectors: [] });
    }
    if (flag === "RED") return withState(prev, "RED", msg);
    if (flag === "CHEQUERED") return withState(prev, "CHEQUERED", msg);
    if (flag === "YELLOW") return withState(prev, "YELLOW", msg);
    if (flag === "DOUBLE YELLOW") return withState(prev, "DOUBLE_YELLOW", msg);
    return prev;
  }

  if (msg.scope === "Sector" && msg.sector != null && flag) {
    const rest = prev.sectors.filter((s) => s.sector !== msg.sector);
    if (YELLOWS.has(flag)) {
      rest.push({ sector: msg.sector, flag, date: msg.t ?? parseTime(msg.date) });
      rest.sort((a, b) => a.sector - b.sector);
      return { ...prev, sectors: rest };
    }
    if (flag === "CLEAR" || flag === "GREEN") {
      return rest.length === prev.sectors.length ? prev : { ...prev, sectors: rest };
    }
  }
  return prev;
}

/** Повна згортка списку повідомлень (у хронологічному порядку). */
export function deriveTrackStatus(messages) {
  let s = initialTrackStatus();
  for (const m of messages) s = reduceTrackStatus(s, m);
  return s;
}

/**
 * Що показати банером (W2): RED > SC/VSC > жовтий на всю трасу > жовті сектори.
 * CLEAR і CHEQUERED банером не показуємо (CHEQUERED - чіп у статус-барі).
 * Повертає {kind, phase, message, sectors} або null.
 */
export function bannerFor(status) {
  if (!status) return null;
  const { state } = status;
  if (state === "RED" || state === "SC" || state === "VSC" || state === "YELLOW" || state === "DOUBLE_YELLOW") {
    return { kind: state, phase: status.phase, message: status.message, sectors: status.sectors };
  }
  if (status.sectors.length) {
    const dbl = status.sectors.some((s) => s.flag === "DOUBLE YELLOW");
    return { kind: dbl ? "SECTOR_DOUBLE_YELLOW" : "SECTOR_YELLOW", phase: null, message: null, sectors: status.sectors };
  }
  return null;
}

// Фільтр «Порушення» стрічки race control (W7).
export const PENALTY_RE = /TRACK LIMITS|PENALTY|INVESTIGATION|INVESTIGATED|DELETED|NOTED|BLACK AND WHITE/i;

/** Категорія фільтра стрічки: "flag" | "sc" | "penalty" | "other". */
export function rcFilterKind(msg) {
  if (msg.category === "SafetyCar") return "sc";
  if (PENALTY_RE.test(msg.message || "") || msg.flag === "BLACK AND WHITE") return "penalty";
  if (msg.category === "Flag") return "flag";
  return "other";
}
