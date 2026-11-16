// Чиста логіка timing tower, статус-бару й банера (агент A): колонки, клітинки,
// чіпи статусу, порядок рядків і планування перестановок. Без React і DOM -
// тестується у Vitest (__tests__/logic.test.js).
//
// Джерела правил: FRONTEND_LIVE_TASKS L7, LIVE_UI_RESEARCH W1-W3, §5.2, §5.8.

import { formatDelta, formatGap, formatLapTime, gapBetween, parseGap, DASH } from "../../../live/format";

/** Режими колонки відставання (гонка). Зберігаються в localStorage. */
export const GAP_MODES = ["interval", "leader", "focus"];
export const DEFAULT_GAP_MODE = "interval";

/** Від цієї швидкості replay ефекти скорочені (§5.8): підсвітка 400 мс, без ▲▼ і світіння, reorder ≤ 1/с. */
export const FAST_SPEED = 5;

/** Тривалості руху (§5.8), мс. */
export const MOTION = {
  reorder: 300,
  tint: 1500,
  tintFast: 400,
  arrows: 5000,
  lapGlow: 600,
  mergeWindow: 250, // буфер подій position: обмін двох місць приходить двома подіями
  fastMinInterval: 1000, // на ×5+ перестановка не частіше разу на секунду
  announceEvery: 5000, // aria-live про позицію вибраного пілота
};

/** Інтервали вважаємо застарілими через 15 с часу сесії (W3 «Стани»). */
export const INTERVALS_STALE_MS = 15000;

// --- колонки ---------------------------------------------------------------

/**
 * Ширини колонок (px; null - гумова колонка пілота). Підібрані під ширини
 * області таблиці в src/live/layout.css: телефон - уся ширина, планшет
 * 300-400, desktop 480-540, wide 560.
 */
export const COLUMN_WIDTH = {
  pos: 34,
  chg: 26,
  driver: null,
  gap: 68,
  qgap: 76,
  last: 74,
  best: 84,
  delta: 58,
  s1: 52,
  s2: 52,
  s3: 52,
  tyre: 54,
  pit: 30,
  pred: 66,
};

const RACE_COLUMNS = {
  mobile: ["pos", "driver", "gap", "tyre"],
  tablet: ["pos", "chg", "driver", "gap", "tyre", "pit"],
  desktop: ["pos", "chg", "driver", "gap", "last", "tyre", "pit", "pred"],
  wide: ["pos", "chg", "driver", "gap", "last", "best", "tyre", "pit", "pred"],
};

// Кваліфікація/практика: замість інтервалів - найкраще коло, Δ до найкращого
// в сесії і сектори останнього кола. qgap (телефон): у лідера - його час,
// в інших - Δ (як у ТВ-графіці).
const QUALI_COLUMNS = {
  mobile: ["pos", "driver", "qgap", "tyre"],
  tablet: ["pos", "chg", "driver", "best", "delta", "tyre"],
  desktop: ["pos", "chg", "driver", "best", "delta", "s1", "s2", "s3", "tyre"],
  wide: ["pos", "chg", "driver", "best", "delta", "last", "s1", "s2", "s3", "tyre"],
};

/** Ключі колонок для layout і типу сесії; showPrediction=false прибирає колонку прогнозу. */
export function columnsFor(layout, isRace, { showPrediction = true } = {}) {
  const set = (isRace ? RACE_COLUMNS : QUALI_COLUMNS)[layout] || (isRace ? RACE_COLUMNS : QUALI_COLUMNS).desktop;
  return showPrediction ? set : set.filter((c) => c !== "pred");
}

/** Чи взагалі показує цей layout колонку прогнозу (щоб не вантажити прогноз даремно). */
export function layoutHasPrediction(layout, isRace) {
  return columnsFor(layout, isRace).includes("pred");
}

// --- порядок рядків ----------------------------------------------------------

/**
 * Порядок показу: як у сторі (за позицією), але в гонці зійшлі (`gone`) - униз,
 * зі збереженням відносного порядку. У кваліфікації/практиці `gone` означає
 * «у гаражі» - такі пілоти лишаються на своїх місцях.
 */
export function displayRows(rows, isRace) {
  if (!isRace) return rows;
  let anyGone = false;
  for (const r of rows) if (r.gone) anyGone = true;
  if (!anyGone) return rows;
  return [...rows.filter((r) => !r.gone), ...rows.filter((r) => r.gone)];
}

/** Ключ порядку (номери через кому) - дешево порівнювати між рендерами. */
export function orderKey(order) {
  return order.join(",");
}

/** Чи той самий набір пілотів (інакше - нова сесія, переставляємо без руху). */
export function sameMembers(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  const s = new Set(a);
  for (const n of b) if (!s.has(n)) return false;
  return true;
}

/**
 * Зміни місць між двома порядками: {n: Δ}, Δ > 0 - піднявся на Δ рядків.
 * Пілоти без зміни не потрапляють у результат.
 */
export function orderDeltas(prevOrder, nextOrder) {
  const out = {};
  if (!prevOrder) return out;
  const prevIdx = new Map(prevOrder.map((n, i) => [n, i]));
  nextOrder.forEach((n, i) => {
    const p = prevIdx.get(n);
    if (p != null && p !== i) out[n] = p - i;
  });
  return out;
}

/**
 * Стрілки ▲N/▼N (живуть MOTION.arrows): нові зміни додаються до ще живих
 * того ж напрямку (дві втрати за 5 с → ▼2), протилежні - замінюють.
 * prev: {n: {delta, until}}; повертає новий об'єкт без прострочених записів.
 */
export function mergeArrows(prev, deltas, now, ttl = MOTION.arrows) {
  const next = {};
  for (const [n, a] of Object.entries(prev || {})) if (a.until > now) next[n] = a;
  for (const [n, d] of Object.entries(deltas)) {
    const cur = next[n];
    const delta = cur && Math.sign(cur.delta) === Math.sign(d) ? cur.delta + d : d;
    if (delta === 0) delete next[n];
    else next[n] = { delta, until: now + ttl };
  }
  return next;
}

/** Найближчий момент, коли якась стрілка згасне (для таймера), або null. */
export function nextArrowExpiry(arrows) {
  let min = null;
  for (const a of Object.values(arrows || {})) if (min == null || a.until < min) min = a.until;
  return min;
}

/**
 * Коли застосувати новий порядок (мс від now). Злиття подій: чекаємо
 * mergeWindow від першої помітної зміни; на ×5+ - ще й не частіше ніж раз на
 * fastMinInterval від попередньої перестановки.
 */
export function reorderDelay({ now, pendingSince, lastAppliedAt, speed }) {
  const since = pendingSince ?? now;
  let at = since + MOTION.mergeWindow;
  if (speed >= FAST_SPEED && lastAppliedAt != null) at = Math.max(at, lastAppliedAt + MOTION.fastMinInterval);
  return Math.max(0, at - now);
}

// --- клітинки ----------------------------------------------------------------

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Клітинка відставання в гонці.
 * mode: "interval" | "leader" | "focus"; refRow - рядок вибраного пілота (або лідера).
 * Повертає {text, kind}: kind ∈ "leader" (підпис «Лідер»), "ref" (опорний пілот
 * режиму «до вибраного»), "value", "laps" (+N кіл), "none" (—).
 */
export function raceGapCell(row, { mode, refRow, t, digits = 3 }) {
  if (mode === "focus") {
    if (refRow && row.driverNumber === refRow.driverNumber) return { text: t("live.tower.gap.reference"), kind: "ref" };
    const ref = refRow ? (refRow.isLeader && refRow.gapToLeader == null ? 0 : refRow.gapToLeader) : null;
    const own = row.isLeader && row.gapToLeader == null ? 0 : row.gapToLeader;
    const d = gapBetween(own, ref);
    if (d == null) return { text: DASH, kind: "none" };
    return { text: formatDelta(d, digits), kind: "value" };
  }
  const value = mode === "leader" ? row.gapToLeader : row.interval;
  if (row.isLeader && (value == null || value === 0)) return { text: t("live.common.leader"), kind: "leader" };
  const g = parseGap(value);
  if (g.kind === "none") return { text: DASH, kind: "none" };
  return { text: formatGap(value, { t, digits }), kind: g.kind === "laps" ? "laps" : "value" };
}

/** Δ до найкращого кола сесії (кваліфікація/практика). У лідера - «Лідер». */
export function qualiDeltaCell(row, { t, digits = 3 }) {
  if (row.isLeader || row.hasSessionBest) return { text: t("live.common.leader"), kind: "leader" };
  if (!isNum(row.gapToBest)) return { text: DASH, kind: "none" };
  return { text: formatDelta(row.gapToBest, digits), kind: "value" };
}

/** Телефонна колонка кваліфікації: у лідера - його найкраще коло, в інших - Δ. */
export function qualiCompactCell(row, { t, digits = 3 }) {
  if (row.isLeader || row.hasSessionBest) {
    return isNum(row.bestLapTime) ? { text: formatLapTime(row.bestLapTime), kind: "best" } : { text: t("live.common.leader"), kind: "leader" };
  }
  return qualiDeltaCell(row, { t, digits });
}

/**
 * Вид клітинки «останнє коло»: "none" (—), "pit" (сірий курсив: коло виїзду
 * або коло з піт-лейном), "session" (фіолетова плашка), "personal" (зелений
 * напівжирний), "normal".
 */
export function lastLapKind(row) {
  if (!isNum(row.lastLapTime)) return "none";
  if (row.lastLapIsPit) return "pit";
  if (row.lastLapIsSessionBest) return "session";
  if (row.lastLapIsPersonalBest) return "personal";
  return "normal";
}

/** Вид клітинки «найкраще коло»: "none" | "session" (плашка + ⏱) | "normal". */
export function bestLapKind(row) {
  if (!isNum(row.bestLapTime)) return "none";
  return row.hasSessionBest ? "session" : "normal";
}

/**
 * Колір сектора k (0..2) останнього кола: "session" - найкращий у сесії,
 * "personal" - особистий найкращий, "normal", "none" (немає значення).
 */
export function sectorKind(value, k, bestSectors, personalSectors) {
  if (!isNum(value)) return "none";
  const sb = bestSectors?.[k]?.time;
  if (isNum(sb) && value <= sb) return "session";
  const pb = personalSectors?.[k];
  if (isNum(pb) && value <= pb) return "personal";
  return "normal";
}

// --- статус пілота -----------------------------------------------------------

/**
 * Коло виїзду з піт-лейну триває: машина вже не в піт-лейні (геометрія),
 * остання подія `pit` (її date ≈ виїзд із боксів) пізніша за кінець останнього
 * завершеного кола, і це коло ще не завершилось. Коли прийде наступне коло
 * (lastLap.t > pit.t) - чіп зникає. Подію pit для «PIT» не використовуємо.
 */
export function isOutLap(row) {
  if (row.inPit || row.gone || !row.lastPit) return false;
  const pitT = row.lastPit.t;
  if (!isNum(pitT)) return false;
  const lapT = row.lastLap?.t;
  return !isNum(lapT) || pitT > lapT;
}

/**
 * Чіпи статусу в клітинці пілота (завжди з текстом, §5.3):
 *   gone → "ret" (гонка: сход) / "garage" (квала, практика);
 *   inPit → "pit"; інакше коло виїзду → "out";
 *   blueFlag (10 с) → "blue"; warning (60 с) → "warn" з повідомленням.
 */
export function rowChips(row, { isRace }) {
  const chips = [];
  if (row.gone) chips.push({ key: isRace ? "ret" : "garage" });
  else if (row.inPit) chips.push({ key: "pit" });
  else if (isOutLap(row)) chips.push({ key: "out" });
  if (row.blueFlag && !row.gone) chips.push({ key: "blue" });
  if (row.warning) chips.push({ key: "warn", message: row.warning.message || "" });
  return chips;
}

/** Інтервали пілота застарілі (> 15 с часу сесії) - колонка тьмяніє з іконкою годинника. */
export function intervalsStale(row, clock) {
  return isNum(clock) && isNum(row.intervalsAt) && clock - row.intervalsAt > INTERVALS_STALE_MS;
}

// --- піт-стопи --------------------------------------------------------------

/** Рядки tooltip піт-стопів: [{lap, lane, stop}] (секунди або null). */
export function pitSummary(pits) {
  return (pits || []).map((p) => ({
    lap: p.lap_number ?? null,
    lane: isNum(p.lane_duration) ? p.lane_duration : isNum(p.pit_duration) ? p.pit_duration : null,
    stop: isNum(p.stop_duration) ? p.stop_duration : null,
  }));
}

// --- кваліфікація: зона вибування -------------------------------------------

/**
 * Позиції, що вибувають у поточній частині кваліфікації, за розміром поля.
 * ПЕРЕВІРИТИ ЗА РЕГЛАМЕНТОМ 2026: у 2026 (11 команд, 22 машини) вважаємо, що
 * вибувають по 6 - P17-P22 у Q1 і P11-P16 у Q2; для поля з 20 машин
 * (2023-2025) - по 5: P16-P20 і P11-P15. Q3 нікого не вибуває.
 */
export const ELIMINATION_ZONES = {
  20: { 1: [16, 20], 2: [11, 15] }, // перевірити за регламентом 2026
  22: { 1: [17, 22], 2: [11, 16] }, // перевірити за регламентом 2026
};

/** Остання відома частина кваліфікації (1/2/3) з race control (новіші першими) або null. */
export function latestQualifyingPhase(messages) {
  for (const m of messages || []) {
    const q = m?.qualifying_phase;
    if (q != null && Number.isFinite(Number(q))) return Number(q);
  }
  return null;
}

/** [від, до] позицій зони вибування або null (не кваліфікація, Q3, невідоме поле). */
export function eliminationRange(phase, fieldSize) {
  const zones = ELIMINATION_ZONES[fieldSize];
  return (zones && zones[phase]) || null;
}

export function inRange(position, range) {
  return !!range && isNum(position) && position >= range[0] && position <= range[1];
}

/** Чи сесія - кваліфікація (у т.ч. спринтерська): лише там є зона вибування. */
export function isQualifyingSession(session) {
  const type = String(session?.session_type || "");
  const name = String(session?.session_name || "");
  return /Qualifying|Shootout/i.test(type) || /Qualifying|Shootout/i.test(name);
}

// --- прогноз ----------------------------------------------------------------

/**
 * Клітинка прогнозу: {predicted, delta} або null. delta > 0 - пілот зараз
 * вище за прогноз (▲), < 0 - нижче (▼).
 */
export function predictionCell(prediction, position) {
  const p = prediction?.predicted_position;
  if (!isNum(p)) return null;
  return { predicted: p, delta: isNum(position) ? p - position : null };
}

// --- доступність --------------------------------------------------------------

/**
 * Текст для aria-live про зміну позиції вибраного пілота або null.
 * prev/next - позиції (числа).
 */
export function positionAnnouncement(name, prev, next, t) {
  if (!isNum(prev) || !isNum(next) || prev === next) return null;
  return t(next < prev ? "live.tower.a11y.gained" : "live.tower.a11y.lost", { name, position: next });
}

// --- статус-бар ---------------------------------------------------------------

/** Порог «немає даних» для індикатора свіжості (W1), мс часу сесії. */
export const NO_DATA_MS = 10000;

/**
 * Стан індикатора свіжості: "fresh" | "buffering" | "nodata" | "paused" |
 * "ended" | "connecting" | "lost" | "error".
 */
export function freshnessState({ status, paused, clock, lastEventAt }) {
  if (status === "error") return "error";
  if (status === "lost") return "lost";
  if (status === "ended") return "ended";
  if (status === "idle" || status === "connecting" || status === "loading") return "connecting";
  if (paused || status === "paused") return "paused";
  if (status === "buffering") return "buffering";
  if (isNum(clock) && isNum(lastEventAt) && clock - lastEventAt > NO_DATA_MS) return "nodata";
  if (isNum(clock) && lastEventAt == null) return "nodata";
  return "fresh";
}

/** Ключ i18n назви сесії (live.tower.sessionName.*) або null для невідомої. */
export function sessionNameKey(name) {
  const s = String(name || "").trim().toLowerCase();
  const map = {
    race: "race",
    qualifying: "qualifying",
    sprint: "sprint",
    "sprint qualifying": "sprintQualifying",
    "sprint shootout": "sprintQualifying",
    "practice 1": "practice1",
    "practice 2": "practice2",
    "practice 3": "practice3",
    "day 1": "testing",
    "day 2": "testing",
    "day 3": "testing",
  };
  return map[s] || null;
}

/** Чіп стану траси в статус-барі: "chequered" (постійно) | "green" (5 с після CLEAR) | null. */
export const GREEN_CHIP_MS = 5000;
export function trackChip(status, clock) {
  if (!status) return null;
  if (status.state === "CHEQUERED") return "chequered";
  if (status.state === "CLEAR" && isNum(status.clearedAt) && isNum(clock) && clock - status.clearedAt >= 0 && clock - status.clearedAt < GREEN_CHIP_MS) return "green";
  return null;
}

// --- банер ----------------------------------------------------------------------

/**
 * Опис банера (W2) з bannerFor(): {tone, abbr, textKey, raw, sectors, double}.
 *   tone: "red" | "sc" | "vsc" | "yellow" - фон (§5.3);
 *   abbr: "SC" | "VSC" | null - абревіатура в плашці (обов'язкова для SC/VSC);
 *   textKey: ключ live.tower.banner.* або null (тоді показуємо raw як є);
 *   sectors: [{sector, double}] для жовтих секторів.
 */
export function describeBanner(banner) {
  if (!banner) return null;
  const sectors = (banner.sectors || []).map((s) => ({ sector: s.sector, double: s.flag === "DOUBLE YELLOW" }));
  switch (banner.kind) {
    case "RED":
      return { tone: "red", abbr: null, textKey: "red", raw: null, sectors: [], double: false };
    case "SC":
    case "VSC": {
      const vsc = banner.kind === "VSC";
      const phase = banner.phase === "DEPLOYED" ? "Deployed" : banner.phase === "ENDING" ? "Ending" : null;
      return {
        tone: vsc ? "vsc" : "sc",
        abbr: banner.kind,
        textKey: phase ? `${vsc ? "vsc" : "sc"}${phase}` : null,
        raw: phase ? null : banner.message || null,
        sectors: [],
        double: false,
      };
    }
    case "YELLOW":
      return { tone: "yellow", abbr: null, textKey: "trackYellow", raw: null, sectors, double: false };
    case "DOUBLE_YELLOW":
      return { tone: "yellow", abbr: null, textKey: "trackDoubleYellow", raw: null, sectors, double: true };
    case "SECTOR_YELLOW":
      return { tone: "yellow", abbr: null, textKey: "sectorYellow", raw: null, sectors, double: false };
    case "SECTOR_DOUBLE_YELLOW":
      return { tone: "yellow", abbr: null, textKey: "sectorDoubleYellow", raw: null, sectors, double: true };
    default:
      return banner.message ? { tone: "yellow", abbr: null, textKey: null, raw: banner.message, sectors, double: false } : null;
  }
}
