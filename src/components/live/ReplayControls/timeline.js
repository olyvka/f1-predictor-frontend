// Чисті функції шкали replay (W9, L5): межі шкали, мітки (кола лідера,
// SC/VSC/RED, жовті прапори, піт-стопи), коло за моментом часу, пресети
// «Від старту» / «Останні 10 кіл». Усі моменти - мс epoch UTC.

import { parseTime } from "../../../live/time";
import { initialTrackStatus, reduceTrackStatus } from "../../../live/trackStatus";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

export const SPEEDS = [0.25, 0.5, 1, 2, 5, 10, 20];
/** Від цієї швидкості бекенд може не встигати тягнути location/car_data. */
export const BUFFERING_SPEED = 10;
/** Крок клавіш: ←/→ 10 с, Shift - 60 с; debounce, бо кожен seek - перепідключення. */
export const KEY_STEP_S = 10;
export const KEY_STEP_SHIFT_S = 60;
export const KEY_DEBOUNCE_MS = 400;

/**
 * Межі шкали. replay.start - це момент, з якого грає ПОТОЧНЕ з'єднання
 * (після перемотування він зсувається), тож ліва межа - найраніший побачений
 * replay.start, але не пізніше запланованого старту (щоб можна було
 * перемотати назад до старту). У фікстурі назад за межу запису не можна.
 * Повертає {lo, hi} або null, якщо ще немає даних.
 */
export function timelineBounds({ sessionStart, replayStart, replayEnd, earliestStart, clampToRecording = false }) {
  if (!isNum(replayEnd)) return null;
  const first = isNum(earliestStart) ? (isNum(replayStart) ? Math.min(earliestStart, replayStart) : earliestStart) : replayStart;
  if (!isNum(first) && !isNum(sessionStart)) return null;
  let lo = isNum(first) ? first : sessionStart;
  if (!clampToRecording && isNum(sessionStart)) lo = Math.min(lo, sessionStart);
  const hi = Math.max(replayEnd, lo + 1000);
  return { lo, hi };
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Частка 0..1 позиції t на шкалі. */
export function fraction(t, bounds) {
  if (!bounds || !isNum(t)) return 0;
  return clamp((t - bounds.lo) / (bounds.hi - bounds.lo), 0, 1);
}

/** Номер лідера з `state.position` ({[n]: {position}}) або null. */
export function leaderFrom(position) {
  if (!position) return null;
  for (const [n, p] of Object.entries(position)) if (p?.position === 1) return Number(n);
  return null;
}

/**
 * Старти кіл лідера [{t, lap}] за зростанням: date_start кожного відомого
 * кола + кінець останнього завершеного (старт поточного кола).
 */
export function lapStarts(leaderLaps) {
  const out = [];
  let last = null;
  for (const l of leaderLaps || []) {
    const t = parseTime(l.date_start);
    if (t != null && l.lap_number != null) out.push({ t, lap: l.lap_number });
    if (l.lap_number != null && (last == null || l.lap_number > last.lap_number)) last = l;
  }
  const lastStart = parseTime(last?.date_start);
  if (last && lastStart != null && isNum(last.lap_duration)) {
    const next = { t: lastStart + last.lap_duration * 1000, lap: last.lap_number + 1 };
    if (!out.some((x) => x.lap === next.lap)) out.push(next);
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

/**
 * Коло лідера в момент t за відомими стартами кіл. Лише до `knownUntil`
 * (поточний clock): майбутнього ми ще не бачили. До першого старту → null.
 */
export function lapAt(starts, t, knownUntil = Infinity) {
  if (!starts?.length || !isNum(t) || t > knownUntil) return null;
  let lap = null;
  for (const s of starts) {
    if (s.t <= t) lap = s.lap;
    else break;
  }
  return lap;
}

/**
 * Мітки шкали:
 *   laps    - [{t, lap}] старти кіл лідера (лише гонка/спринт);
 *   periods - [{kind: "SC"|"VSC"|"RED", from, to (null - триває)}];
 *   yellows - [{t, double}] жовті / подвійні жовті (сектор або вся траса);
 *   pits    - [{t, driverNumber}].
 * raceControl - новіші першими (як у сторі).
 */
export function computeMarkers({ leaderLaps, raceControl, pits, isRace }) {
  const laps = isRace ? lapStarts(leaderLaps) : [];

  const periods = [];
  const yellows = [];
  let status = initialTrackStatus();
  let open = null;
  const rc = raceControl || [];
  for (let i = rc.length - 1; i >= 0; i--) {
    const m = rc[i];
    const t = m.t ?? parseTime(m.date);
    if (t == null) continue;
    const flag = m.flag ? String(m.flag).toUpperCase() : null;
    if (flag === "YELLOW" || flag === "DOUBLE YELLOW") yellows.push({ t, double: flag === "DOUBLE YELLOW" });
    const next = reduceTrackStatus(status, m);
    if (next === status) continue;
    status = next;
    const kind = ["SC", "VSC", "RED"].includes(status.state) ? status.state : null;
    if (open && open.kind !== kind) {
      open.to = t;
      open = null;
    }
    if (kind && !open) {
      open = { kind, from: t, to: null };
      periods.push(open);
    }
  }

  const pitList = [];
  for (const [n, arr] of Object.entries(pits || {})) {
    for (const p of arr || []) {
      const t = p.t ?? parseTime(p.date);
      if (t != null) pitList.push({ t, driverNumber: Number(n) });
    }
  }
  pitList.sort((a, b) => a.t - b.t);

  return { laps, periods, yellows, pits: pitList };
}

/**
 * Пресет «Від старту»: старт першого кола лідера (гонка), інакше перше
 * «SESSION STARTED» race control, інакше запланований старт (offset 0).
 * Повертає мс epoch.
 */
export function fromStartTime({ leaderLaps, raceControl, sessionStart, isRace }) {
  if (isRace) {
    const first = (leaderLaps || []).find((l) => l.lap_number === 1);
    const t = parseTime(first?.date_start);
    if (t != null) return t;
  }
  const rc = raceControl || [];
  for (let i = rc.length - 1; i >= 0; i--) {
    const m = rc[i];
    if (m.category === "SessionStatus" && /SESSION STARTED/i.test(m.message || "")) {
      const t = m.t ?? parseTime(m.date);
      if (t != null) return t;
    }
  }
  return isNum(sessionStart) ? sessionStart : null;
}

const median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/**
 * Пресет «Останні N кіл» (лише гонка): момент старту кола (total − N + 1)
 * лідера. Якщо коло вже відоме - точно; інакше оцінка від останнього відомого
 * старту кола × медіанний час кола лідера (без 1-го кола й кіл із піт-лейном).
 * Повертає {t, lap, estimated} або null (немає total / кіл / гонка коротша).
 */
export function lastLapsTime({ leaderLaps, total, count = 10, isRace = true }) {
  if (!isRace || !isNum(total) || total <= count) return null;
  const targetLap = total - count + 1;
  const starts = lapStarts(leaderLaps);
  if (!starts.length) return null;
  const exact = starts.find((s) => s.lap === targetLap);
  if (exact) return { t: exact.t, lap: targetLap, estimated: false };
  const last = starts[starts.length - 1];
  if (last.lap > targetLap) {
    // старт цього кола невідомий, але пізніші є: беремо найближчий попередній відомий
    const before = starts.filter((s) => s.lap < targetLap).pop();
    if (!before) return null;
    const durs = cleanDurations(leaderLaps);
    const avg = median(durs);
    if (avg == null) return null;
    return { t: before.t + (targetLap - before.lap) * avg * 1000, lap: targetLap, estimated: true };
  }
  const avg = median(cleanDurations(leaderLaps));
  if (avg == null) return null;
  return { t: last.t + (targetLap - last.lap) * avg * 1000, lap: targetLap, estimated: true };
}

function cleanDurations(laps) {
  const out = [];
  for (const l of laps || []) {
    if (!isNum(l.lap_duration) || l.lap_number == null || l.lap_number <= 1 || l.is_pit_out_lap) continue;
    out.push(l.lap_duration);
  }
  return out;
}
