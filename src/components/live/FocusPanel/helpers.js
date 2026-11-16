// Чисті функції панелі «Пілот у фокусі» (L8, L11, L12; LIVE_UI_RESEARCH W5, W6,
// W12, W13). Без React і без i18n, тож тестуються у Vitest
// (__tests__/helpers.test.js).

import { DASH } from "../../../live/format";

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// --- жива телеметрія (W5) ---

/** Верхня межа смуги обертів (у даних 2026 максимум ≈ 13 200). */
export const RPM_MAX = 13000;
/** car_data старіша за це → приглушити й «немає телеметрії». */
export const STALE_MS = 3000;
/** Швидкість нижче цього - червона (як у MultiViewer). */
export const SLOW_KMH = 30;

/** Передача: 0 → «N», null → «—». */
export function gearLabel(gear) {
  if (!isNum(gear)) return DASH;
  return gear === 0 ? "N" : String(Math.round(gear));
}

/** Частка 0..100 для ширини смуги (газ іноді 104 → 100). null → 0. */
export function barPercent(value, max = 100) {
  if (!isNum(value) || !(max > 0)) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Гальмо в даних лише 0/100 (іноді 104): будь-що > 0 - увімкнено. */
export function isBraking(brake) {
  return isNum(brake) && brake > 0;
}

/** Обороти коротко: 11234 → "11.2k"; null → "—". */
export function formatRpm(rpm) {
  return isNum(rpm) ? `${(rpm / 1000).toFixed(1)}k` : DASH;
}

/**
 * Останній семпл з s.t ≤ t у впорядкованому за часом масиві (бінарний пошук).
 * null, якщо всі семпли пізніші або масив порожній.
 */
export function sampleAt(samples, t) {
  if (!samples || !samples.length || !isNum(t)) return null;
  let lo = 0;
  let hi = samples.length - 1;
  if (samples[0].t > t) return null;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid - 1;
  }
  return samples[lo];
}

/**
 * Семпл car_data на момент t із буфера телеметрії стору
 * (store.getTelemetryLap(n) = {current, previous}): спершу поточне коло,
 * далі попереднє (одразу після перетину лінії t може бути ще в ньому).
 */
export function pickTelemetrySample(tel, t) {
  if (!tel) return null;
  return sampleAt(tel.current, t) || sampleAt(tel.previous, t);
}

/** Семпл застарів: немає семплу або він старший за STALE_MS від моменту now. */
export function isStale(sampleT, now, ms = STALE_MS) {
  if (!isNum(sampleT)) return true;
  if (!isNum(now)) return false;
  return now - sampleT > ms;
}

// --- сектори й міні-сектори (L11, W12, §5.2) ---

/**
 * Колір часу (кола або сектора): "session" (фіолетовий, найкращий у сесії),
 * "personal" (зелений, особистий найкращий), "none" (без покращення) або null
 * (значення немає). Порівнюємо з допуском, бо час - число з плаваючою комою.
 */
export function timingKind(value, personalBest, sessionBest) {
  if (!isNum(value)) return null;
  const eq = (a) => isNum(a) && Math.abs(a - value) < 1e-6;
  if (eq(sessionBest)) return "session";
  if (eq(personalBest)) return "personal";
  return "none";
}

/** Коди міні-секторів OpenF1 → вид (2050/2052/2068, 0, null - «немає даних»). */
export const MINI_SECTOR_CODES = { 2048: "yellow", 2049: "green", 2051: "purple", 2064: "pit" };

export function miniSectorKind(code) {
  return MINI_SECTOR_CODES[code] || "none";
}

/**
 * Міні-сектори кола: [[вид…] ×3] або null, якщо даних немає взагалі
 * (у live під час гонки segments_sector_* можуть бути null - тоді лише S1-S3,
 * без порожньої смужки).
 */
export function lapMiniSectors(lap) {
  if (!lap) return null;
  let known = 0;
  const out = [1, 2, 3].map((k) => {
    const arr = Array.isArray(lap[`segments_sector_${k}`]) ? lap[`segments_sector_${k}`] : [];
    return arr.map((code) => {
      const kind = miniSectorKind(code);
      if (kind !== "none") known++;
      return kind;
    });
  });
  return known ? out : null;
}

/** Коло з піт-лейном: виїзд (is_pit_out_lap) або міні-сектор 2064 (заїзд). */
export function lapPitFlag(lap) {
  if (!lap) return null;
  if (lap.is_pit_out_lap) return "out";
  for (let k = 1; k <= 3; k++) if ((lap[`segments_sector_${k}`] || []).includes(2064)) return "in";
  return null;
}

/** Компаунд стінта, що покриває коло lapNumber (stints за stint_number). */
export function compoundForLap(stints, lapNumber) {
  if (!stints?.length || !isNum(lapNumber)) return null;
  let found = null;
  for (const s of stints) {
    const start = isNum(s.lap_start) ? s.lap_start : 1;
    const end = isNum(s.lap_end) ? s.lap_end : Infinity;
    if (lapNumber >= start && lapNumber <= end) found = s; // пізніший стінт перемагає
  }
  return found?.compound ?? null;
}

// --- траса швидкості (W6) ---

/** Межа шкали швидкості (км/год). Мітки - лише 100/200/300. */
export const TRACE_VMAX = 350;
export const TRACE_LABELS = [100, 200, 300];
/** Пропуск у частці кола, більший за цей, розриває лінію (немає location). */
export const TRACE_MAX_GAP = 0.04;

/**
 * Розбиває точки {f, speed…} (за часом) на неперервні відрізки: новий відрізок,
 * якщо f зменшилась або стрибнула більше ніж на maxGap.
 */
export function splitSegments(points, maxGap = TRACE_MAX_GAP) {
  const out = [];
  let cur = null;
  let prevF = null;
  for (const p of points || []) {
    if (!isNum(p.f) || !isNum(p.speed)) continue;
    if (!cur || p.f < prevF || p.f - prevF > maxGap) {
      cur = [];
      out.push(cur);
    }
    cur.push(p);
    prevF = p.f;
  }
  return out;
}

/**
 * Децимація min/max на піксель: у кожній колонці ширини width лишаємо першу,
 * мінімальну, максимальну й останню точки (у порядку появи). Відрізок, коротший
 * за 4 точки на колонку, повертається як є.
 */
export function decimate(points, width) {
  if (!points || points.length <= Math.max(4, width * 4) || !(width > 0)) return points || [];
  const out = [];
  let col = null;
  let bucket = [];
  const flush = () => {
    if (!bucket.length) return;
    let lo = bucket[0];
    let hi = bucket[0];
    for (const p of bucket) {
      if (p.speed < lo.speed) lo = p;
      if (p.speed > hi.speed) hi = p;
    }
    const keep = new Set([bucket[0], lo, hi, bucket[bucket.length - 1]]);
    for (const p of bucket) if (keep.has(p)) out.push(p);
    bucket = [];
  };
  for (const p of points) {
    const c = Math.floor(p.f * width);
    if (c !== col) {
      flush();
      col = c;
    }
    bucket.push(p);
  }
  flush();
  return out;
}

/**
 * Зони гальмування поточного кола: [[f0, f1], …], де brake > 0. Зона триває до
 * наступного семплу (якщо він не далі maxGap), сусідні зони зливаються.
 */
export function brakeZones(points, maxGap = TRACE_MAX_GAP) {
  const zones = [];
  const list = points || [];
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    if (!isNum(p.f) || !isBraking(p.brake)) continue;
    const next = list[i + 1];
    const end = next && isNum(next.f) && next.f >= p.f && next.f - p.f <= maxGap ? next.f : p.f + 0.002;
    const last = zones[zones.length - 1];
    if (last && p.f <= last[1] + 1e-9) last[1] = Math.max(last[1], end);
    else zones.push([p.f, end]);
  }
  return zones;
}

/** Максимальна швидкість у точках або null. */
export function maxSpeed(points) {
  let m = null;
  for (const p of points || []) if (isNum(p.speed) && (m == null || p.speed > m)) m = p.speed;
  return m;
}

/**
 * Стан траси для підпису: "empty" (даних нема), "afterSeek" (лише неповне
 * поточне коло без попереднього - після перемотки/підключення посеред кола),
 * "partial" (поточне коло почалось до запису), "ok".
 */
export function traceState(trace) {
  if (!trace || (!trace.current?.length && !trace.previous?.length)) return "empty";
  if (trace.partial && !trace.previous?.length) return "afterSeek";
  if (trace.partial) return "partial";
  return "ok";
}

// --- модель vs гонка (L12, W13, §7.1) ---

/**
 * Різниця прогнозу й поточного місця: predicted − current. Плюс - пілот
 * зараз вище за прогноз (▲, краще), мінус - нижче (▼). null, якщо чогось немає.
 */
export function positionDelta(predicted, current) {
  return isNum(predicted) && isNum(current) ? predicted - current : null;
}

/**
 * Головні фактори пояснення (SHAP): k з найбільшим |impact|, решта додається
 * до «інших». {factors, other, max} або null без пояснення.
 */
export function topFactors(explanation, k = 5) {
  if (!explanation || !Array.isArray(explanation.factors)) return null;
  const sorted = [...explanation.factors].filter((f) => isNum(f.impact)).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const factors = sorted.slice(0, k);
  const rest = sorted.slice(k).reduce((s, f) => s + f.impact, 0);
  const other = (isNum(explanation.other) ? explanation.other : 0) + rest;
  const max = Math.max(0.1, Math.abs(other), ...factors.map((f) => Math.abs(f.impact)));
  return { factors, other, max };
}

/** Знакове число в позиціях, як на сторінці аналізу: +1.3 / −0.4 / 0.0. */
export function signedImpact(v) {
  if (!isNum(v)) return DASH;
  const r = Math.abs(v) < 0.05 ? 0 : v;
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(1)}`;
}

/**
 * Пари для плитки «Модель vs гонка»: [{position, predicted}] лише для
 * зіставлених пілотів з поточною позицією, що не зійшли (rows - useTower().rows).
 */
export function modelPairs(rows, byNumber) {
  const out = [];
  for (const r of rows || []) {
    const p = byNumber?.[r.driverNumber];
    if (!p || r.gone || !isNum(r.position) || !isNum(p.predicted_position)) continue;
    out.push({ position: r.position, predicted: p.predicted_position });
  }
  return out;
}

/** Ймовірність 0..1 → відсотки цілим числом; null → null. */
export function percent(p) {
  return isNum(p) ? Math.round(p * 100) : null;
}
