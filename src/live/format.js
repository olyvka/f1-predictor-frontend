// Форматування чисел екрана Live. Чисті функції без імпорту i18n: локалізовані
// підписи (напр. «+1 коло») приходять через параметр `t` (функція з
// useTranslation), тож модуль тестується в Node без браузера.
//
// Правило «null → —»: жодна функція не повертає "0", "NaN" чи порожній рядок
// замість відсутнього значення.

export const DASH = "—";

const pad = (v, n = 2) => String(v).padStart(n, "0");
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/** Час кола: 72.456 → "1:12.456"; < 60 с → "59.123". null → "—". */
export function formatLapTime(seconds) {
  if (!isNum(seconds)) return DASH;
  const ms = Math.round(seconds * 1000);
  const m = Math.floor(ms / 60000);
  const rest = (ms - m * 60000) / 1000;
  return m > 0 ? `${m}:${rest.toFixed(3).padStart(6, "0")}` : rest.toFixed(3);
}

/** Час сектора: 23.4561 → "23.456". */
export function formatSectorTime(seconds) {
  return isNum(seconds) ? seconds.toFixed(3) : DASH;
}

/**
 * Розбір значення `intervals.gap_to_leader` / `.interval`:
 *   число → {kind: "time", seconds}; "+1 LAP" / "+2 LAPS" → {kind: "laps", laps};
 *   null → {kind: "none"}; інший рядок → {kind: "raw", text}.
 */
export function parseGap(value) {
  if (isNum(value)) return { kind: "time", seconds: value };
  if (value == null) return { kind: "none" };
  if (typeof value === "string") {
    const m = value.trim().match(/^\+?\s*(\d+)\s*LAPS?$/i);
    if (m) return { kind: "laps", laps: Number(m[1]) };
    const num = Number(value);
    if (value.trim() !== "" && Number.isFinite(num)) return { kind: "time", seconds: num };
    return { kind: "raw", text: value };
  }
  return { kind: "none" };
}

/**
 * Відставання: `+1.234`; ≥ 60 с → `+1:02.3`; рядок «+1 LAP» → локалізовано
 * через `t("live.common.lapsDown", {count})`, без `t` → як прийшло; null → "—".
 * opts.digits - знаків після коми для < 60 с (3 на desktop, 1 на телефоні).
 */
export function formatGap(value, { t, digits = 3 } = {}) {
  const g = parseGap(value);
  if (g.kind === "none") return DASH;
  if (g.kind === "raw") return g.text;
  if (g.kind === "laps") return t ? t("live.common.lapsDown", { count: g.laps }) : `+${g.laps} LAP${g.laps === 1 ? "" : "S"}`;
  const v = g.seconds;
  if (Math.abs(v) >= 60) {
    const sign = v < 0 ? "−" : "+";
    const tenths = Math.round(Math.abs(v) * 10);
    const m = Math.floor(tenths / 600);
    const rest = (tenths - m * 600) / 10;
    return `${sign}${m}:${rest.toFixed(1).padStart(4, "0")}`;
  }
  return `${v < 0 ? "−" : "+"}${Math.abs(v).toFixed(digits)}`;
}

/** Знакова різниця (до найкращого кола, до вибраного): +0.123 / −0.123 / ±0.000. */
export function formatDelta(seconds, digits = 3) {
  if (!isNum(seconds)) return DASH;
  const r = Number(seconds.toFixed(digits));
  if (r === 0) return `±${(0).toFixed(digits)}`;
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(digits)}`;
}

/**
 * Різниця відставань двох пілотів (режим «до вибраного»): gap(n) − gap(sel).
 * Лише якщо обидва - числа, інакше null.
 */
export function gapBetween(gapA, gapB) {
  const a = parseGap(gapA);
  const b = parseGap(gapB);
  return a.kind === "time" && b.kind === "time" ? a.seconds - b.seconds : null;
}

/**
 * Годинник сесії з секунд: 3737 → "1:02:17"; hours: "auto" ховає години,
 * якщо їх 0 ("02:17"). Від'ємне (до старту) → "−0:05:00".
 */
export function formatClock(seconds, { hours = "auto" } = {}) {
  if (!isNum(seconds)) return DASH;
  const neg = seconds < 0;
  const s = Math.floor(Math.abs(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const x = s % 60;
  const body = hours === true || (hours === "auto" && h > 0) ? `${h}:${pad(m)}:${pad(x)}` : `${pad(m)}:${pad(x)}`;
  return neg ? `−${body}` : body;
}

/** Ціле число або "—" (швидкість, температура, rpm). */
export function formatInt(value) {
  return isNum(value) ? String(Math.round(value)) : DASH;
}
