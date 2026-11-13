// Стор live-стану (L2): згортає повідомлення протоколу в нормалізований стан.
//
// Два шари даних:
//   1. «Реактивний» стан (сесія, позиції, інтервали, кола, стінти, піти, race
//      control, погода, остання car_data, фокус). Оновлюється copy-on-write:
//      змінений контейнер/масив отримує нову ідентичність, тож селектори з
//      Object.is/useMemo бачать зміни. Підписники отримують сповіщення ПО
//      КАНАЛАХ і не частіше ніж раз на throttleMs (≈ раз на batch, ≤ 4-5/с).
//   2. Високочастотні буфери (location, car_data поточного кола) - мутабельні,
//      поза React. Карта читає їх у requestAnimationFrame через getCarsAt(),
//      графіки - через getSpeedTrace(). Окремі події location/car_data НЕ
//      викликають ре-рендерів.
//
// Контракт для віджетів - src/live/README.md.

import { parseTime } from "./time";
import { buildTrackGeometry, projectOnTrack, unwrapLapFraction, PIT_LANE_DISTANCE } from "./geometry";
import { fixContrast, normalizeHex, DEFAULT_SURFACE, FALLBACK_TEAM_COLOR } from "./color";
import { initialTrackStatus, reduceTrackStatus, PENALTY_RE } from "./trackStatus";
import { currentStint, tyreAge, isUsedSet } from "./tyres";
import { TimeRing } from "./ringBuffer";

/** Канали підписки (див. README, «Канали»). */
export const CHANNELS = ["meta", "playback", "table", "focus", "rc", "weather", "telemetry"];

export const LIMITS = {
  raceControl: 200, // записів у лозі race control
  trailCapacity: 96, // семплів location на пілота (~26 с при 3.7 Гц)
  trailMs: 20000, // «хвіст» для карти
  telemetrySamples: 3000, // car_data поточного кола на пілота (запобіжник для дуже довгих кіл)
  seenPoints: 4000, // розріджені точки location для автоповороту/bbox карти
};

export const THRESHOLDS = {
  blueFlagMs: 10000, // синій прапор у таблиці
  warningMs: 60000, // ⚠ штраф/розслідування/трек-ліміти
  staleLocationMs: 10000, // машина приглушена на карті
  goneMs: 30000, // немає location > 30 с → сход/гараж
  fractionGiveUpMs: 3000, // car_data без парного location
  maxInterpolationGapMs: 2000, // пропуск між семплами location - без lerp
};

const SPEED_MIN = 0.25;
const SPEED_MAX = 20;
export const clampSpeed = (v) => Math.max(SPEED_MIN, Math.min(SPEED_MAX, Number(v) || 1));

/** Затримка відмальовки карти від годинника: D = max(0.6 с, 0.4 × speed) у часі сесії. */
export const renderDelayMs = (speed) => Math.max(600, 400 * (speed || 1));

const defaultNow = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

function emptyData() {
  return {
    mode: null, // "replay" | "live"
    session: null, // session{...} з повідомлення "session"
    sessionStart: null, // мс epoch session.date_start
    replay: null, // {start, end, speed, startMs, endMs} або null у live
    drivers: {}, // {[n]: Driver}
    driverNumbers: [], // відсортовані номери
    track: null, // {points, geometry} або null
    position: {}, // {[n]: {position, t}}
    intervals: {}, // {[n]: {gap_to_leader, interval, t}}
    laps: {}, // {[n]: Lap[]} за lap_number
    stints: {}, // {[n]: Stint[]} за stint_number
    pits: {}, // {[n]: Pit[]} за часом
    raceControl: [], // новіші першими, ≤ LIMITS.raceControl
    weather: null,
    carData: {}, // {[n]: остання car_data + t}
    best: { lap: null, sectors: [null, null, null] }, // {time, driverNumber, lapNumber}
    personalBest: {}, // {[n]: {lap, lapNumber, sectors: [s1, s2, s3]}}
    trackStatus: initialTrackStatus(),
    derived: { inPit: {}, gone: {}, stale: {}, blueFlag: {}, warning: {} },
    watchStart: null, // мс epoch, з якого моменту дивимось (replay.start)
    lastEventAt: null, // мс epoch (час сесії) останньої події з датою
  };
}

function initialPlayback() {
  return {
    mode: null,
    status: "idle", // idle | connecting | loading | playing | paused | buffering | ended | error | lost
    error: null, // detail останньої помилки
    reconnect: null, // {attempt, retryAt (performance.now мс), delayMs} у стані lost
    connId: 0,
    speed: 1,
    paused: false,
    clock: null, // мс epoch, останній clock від сервера (або оптимістичний)
    clockRecvAt: 0, // performance.now() отримання clock
    epoch: 0, // ++ при скиданні стану та catch-up: віджети пропускають анімації
    seeking: null, // {offset, target (мс epoch)} - поки нове з'єднання не дало session
    ended: false,
    lastBatchAt: null, // performance.now() останнього batch
  };
}

const isNum = (v) => typeof v === "number" && Number.isFinite(v);

// Коло з піт-лейном: виїзд або міні-сектор 2064 (піт-лейн).
export function isPitLap(lap) {
  if (!lap) return false;
  if (lap.is_pit_out_lap) return true;
  for (const k of [1, 2, 3]) {
    const seg = lap[`segments_sector_${k}`];
    if (Array.isArray(seg) && seg.includes(2064)) return true;
  }
  return false;
}

// Номери машин зі згадок «CAR 87 (BEA)» / «CARS 12 (ANT) AND 1 (VER)».
export function carsMentioned(message) {
  const out = [];
  const re = /\b(\d{1,2})\s*\(([A-Z]{3})\)/g;
  let m;
  while ((m = re.exec(String(message || "")))) out.push(Number(m[1]));
  return out;
}

function upsertBy(arr, item, key) {
  const next = arr ? arr.slice() : [];
  const i = next.findIndex((x) => x[key] === item[key]);
  if (i >= 0) next[i] = item;
  else {
    next.push(item);
    next.sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0));
  }
  return next;
}

function shallowEqualMaps(a, b) {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (a[k] !== b[k]) return false;
  return true;
}

/**
 * Створює стор. Опції:
 *   now        - джерело монотонного часу (мс), за замовчуванням performance.now
 *   throttleMs - мінімальний інтервал сповіщень підписників (0 - синхронно, для тестів)
 *   surface    - фон для виправлення контрасту кольорів команд
 */
export function createLiveStore({ now = defaultNow, throttleMs = 200, surface = DEFAULT_SURFACE } = {}) {
  let data = emptyData();
  let playback = initialPlayback();
  let ui = { focus: null, rival: null };

  // --- високочастотні буфери (мутабельні, поза React) ---
  const trails = new Map(); // n → TimeRing
  const telemetry = new Map(); // n → {lapStart, lapNumber, current[], previous[], previousLap}
  const projHint = new Map(); // n → індекс відрізка контуру для O(1)-проєкції
  const seen = { xs: new Float64Array(LIMITS.seenPoints), ys: new Float64Array(LIMITS.seenPoints), size: 0, next: 0, counter: 0 };
  const lastLocationAt = {}; // n → мс epoch
  let tableInstant = false; // поточний знімок таблиці - результат catch-up/скидання
  let lastLocal = null; // монотонність getClockLocal у межах epoch
  let lastLocalEpoch = -1;

  // --- підписки ---
  const versions = Object.fromEntries(CHANNELS.map((c) => [c, 0]));
  const listeners = Object.fromEntries(CHANNELS.map((c) => [c, new Set()]));
  const dirty = new Set();
  let lastFlush = -Infinity;
  let flushTimer = null;
  let snapshot = null;
  let caches = { tower: null, towerKey: -1, trace: new Map() };

  function mark(...channels) {
    for (const c of channels) dirty.add(c);
  }

  function flush() {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    if (!dirty.size) return;
    lastFlush = now();
    const toCall = new Set();
    for (const c of dirty) {
      versions[c]++;
      for (const l of listeners[c]) toCall.add(l);
    }
    dirty.clear();
    snapshot = null;
    for (const l of toCall) l();
  }

  function scheduleFlush(force = false) {
    if (!dirty.size) return;
    const wait = throttleMs - (now() - lastFlush);
    if (force || throttleMs <= 0 || wait <= 0) flush();
    else if (!flushTimer) flushTimer = setTimeout(flush, wait);
  }

  // --- сесія ---
  function applySession(msg) {
    const keepUi = ui;
    data = emptyData();
    resetBuffers();
    const session = msg.session || null;
    data.mode = msg.mode || "replay";
    data.session = session;
    data.sessionStart = parseTime(session?.date_start);
    data.replay = msg.replay ? { ...msg.replay, startMs: parseTime(msg.replay.start), endMs: parseTime(msg.replay.end) } : null;

    const drivers = {};
    const byTeam = new Map();
    for (const d of msg.drivers || []) {
      if (d?.driver_number == null) continue;
      const n = d.driver_number;
      const raw = normalizeHex(d.team_colour);
      drivers[n] = {
        ...d,
        number: n,
        acronym: d.name_acronym || String(n),
        rawColor: raw || FALLBACK_TEAM_COLOR,
        color: fixContrast(raw || FALLBACK_TEAM_COLOR, surface),
        teammate: null,
        isSecondTeammate: false,
      };
      const team = d.team_name || `#${n}`;
      if (!byTeam.has(team)) byTeam.set(team, []);
      byTeam.get(team).push(n);
    }
    for (const nums of byTeam.values()) {
      nums.sort((a, b) => a - b);
      nums.forEach((n, i) => {
        drivers[n].isSecondTeammate = i > 0;
        drivers[n].teammate = nums.length > 1 ? nums[i === 0 ? 1 : 0] : null;
      });
    }
    data.drivers = drivers;
    data.driverNumbers = Object.keys(drivers).map(Number).sort((a, b) => a - b);

    const points = msg.track?.points;
    data.track = Array.isArray(points) && points.length > 1 ? { points, geometry: buildTrackGeometry(points) } : null;
    data.watchStart = data.replay?.startMs ?? null;

    ui = {
      focus: keepUi.focus != null && drivers[keepUi.focus] ? keepUi.focus : null,
      rival: keepUi.rival != null && drivers[keepUi.rival] ? keepUi.rival : null,
    };
    playback = {
      ...playback,
      mode: data.mode,
      speed: data.replay?.speed != null ? clampSpeed(data.replay.speed) : playback.speed,
      clock: data.replay?.startMs ?? playback.clock,
      clockRecvAt: now(),
      epoch: playback.epoch + 1,
      seeking: null,
      ended: false,
      error: null,
    };
    tableInstant = true;
    caches = { tower: null, towerKey: -1, trace: new Map() };
    mark(...CHANNELS);
  }

  function resetBuffers() {
    trails.clear();
    telemetry.clear();
    projHint.clear();
    seen.size = 0;
    seen.next = 0;
    seen.counter = 0;
    for (const k of Object.keys(lastLocationAt)) delete lastLocationAt[k];
    lastLocal = null;
  }

  // --- події ---
  function applyLocation(d, t) {
    const n = d.driver_number;
    if (n == null || !isNum(d.x) || !isNum(d.y) || t == null) return;
    let ring = trails.get(n);
    if (!ring) trails.set(n, (ring = new TimeRing(LIMITS.trailCapacity)));
    if (ring.push(t, d.x, d.y)) {
      lastLocationAt[n] = t;
      if (seen.counter++ % 10 === 0) {
        seen.xs[seen.next] = d.x;
        seen.ys[seen.next] = d.y;
        seen.next = (seen.next + 1) % LIMITS.seenPoints;
        if (seen.size < LIMITS.seenPoints) seen.size++;
      }
    }
  }

  function telemetryOf(n) {
    let tel = telemetry.get(n);
    if (!tel) telemetry.set(n, (tel = { lapStart: null, lapNumber: null, current: [], previous: [], previousLap: null }));
    return tel;
  }

  function applyCarData(d, t) {
    const n = d.driver_number;
    if (n == null) return;
    data.carData = { ...data.carData, [n]: { ...d, t } };
    if (t != null) {
      const tel = telemetryOf(n);
      tel.current.push({ t, speed: d.speed, throttle: d.throttle, brake: d.brake, gear: d.n_gear, rpm: d.rpm, f: undefined });
      if (tel.current.length > LIMITS.telemetrySamples) tel.current.splice(0, tel.current.length - LIMITS.telemetrySamples);
    }
    mark("telemetry");
  }

  function applyLap(d, batchClock) {
    const n = d.driver_number;
    if (n == null || d.lap_number == null) return;
    const start = parseTime(d.date_start);
    const done = start != null && isNum(d.lap_duration) ? start + d.lap_duration * 1000 : batchClock;
    const prevArr = data.laps[n];
    const maxKnown = prevArr?.length ? prevArr[prevArr.length - 1].lap_number : 0;
    const lap = { ...d, t: done };
    const arr = upsertBy(prevArr, lap, "lap_number");
    data.laps = { ...data.laps, [n]: arr };

    // особисті й сесійні найкращі
    const pb = { lap: null, lapNumber: null, sectors: [null, null, null] };
    for (const l of arr) {
      if (isNum(l.lap_duration) && (pb.lap == null || l.lap_duration < pb.lap)) {
        pb.lap = l.lap_duration;
        pb.lapNumber = l.lap_number;
      }
      for (let k = 0; k < 3; k++) {
        const v = l[`duration_sector_${k + 1}`];
        if (isNum(v) && (pb.sectors[k] == null || v < pb.sectors[k])) pb.sectors[k] = v;
      }
    }
    data.personalBest = { ...data.personalBest, [n]: pb };
    recomputeSessionBest();

    // телеметрія: нове завершене коло → поточне стає попереднім
    if (d.lap_number >= maxKnown && done != null) {
      const tel = telemetryOf(n);
      tel.previous = tel.current.filter((s) => s.t < done && (start == null || s.t >= start));
      tel.previousLap = { lapNumber: d.lap_number, start, end: done };
      tel.current = tel.current.filter((s) => s.t >= done);
      tel.lapStart = done;
      tel.lapNumber = d.lap_number + 1;
      mark("telemetry");
    }
    mark("table");
  }

  function recomputeSessionBest() {
    const best = { lap: null, sectors: [null, null, null] };
    for (const [key, pb] of Object.entries(data.personalBest)) {
      const n = Number(key);
      if (pb.lap != null && (best.lap == null || pb.lap < best.lap.time)) best.lap = { time: pb.lap, driverNumber: n, lapNumber: pb.lapNumber };
      for (let k = 0; k < 3; k++) {
        const v = pb.sectors[k];
        if (v != null && (best.sectors[k] == null || v < best.sectors[k].time)) best.sectors[k] = { time: v, driverNumber: n };
      }
    }
    data.best = best;
  }

  function applyEvent(e, batchClock) {
    const d = e?.data;
    if (!d) return;
    const t = d.date != null ? parseTime(d.date) : batchClock;
    if (t != null && d.date != null && (data.lastEventAt == null || t > data.lastEventAt)) data.lastEventAt = t;
    const n = d.driver_number;
    switch (e.topic) {
      case "location":
        applyLocation(d, t);
        break;
      case "car_data":
        applyCarData(d, t);
        break;
      case "position":
        if (n == null) break;
        data.position = { ...data.position, [n]: { position: d.position ?? null, t } };
        mark("table");
        break;
      case "intervals":
        if (n == null) break;
        data.intervals = { ...data.intervals, [n]: { gap_to_leader: d.gap_to_leader ?? null, interval: d.interval ?? null, t } };
        mark("table");
        break;
      case "laps":
        applyLap(d, batchClock);
        break;
      case "stints":
        if (n == null || d.stint_number == null) break;
        data.stints = { ...data.stints, [n]: upsertBy(data.stints[n], { ...d, t }, "stint_number") };
        mark("table");
        break;
      case "pit": {
        if (n == null) break;
        const arr = data.pits[n] || [];
        if (arr.some((p) => p.date === d.date && p.lap_number === d.lap_number)) break; // повтор після перепідключення
        data.pits = { ...data.pits, [n]: [...arr, { ...d, t }].sort((a, b) => (a.t ?? 0) - (b.t ?? 0)) };
        mark("table");
        break;
      }
      case "race_control": {
        const msg = { ...d, t };
        const list = [msg, ...data.raceControl];
        // зазвичай подія новіша за всі; якщо ні - відновлюємо порядок
        if (list.length > 1 && (list[1].t ?? 0) > (t ?? 0)) list.sort((a, b) => (b.t ?? 0) - (a.t ?? 0));
        if (list.length > LIMITS.raceControl) list.length = LIMITS.raceControl;
        data.raceControl = list;
        data.trackStatus = reduceTrackStatus(data.trackStatus, msg);
        mark("rc"); // сині прапори/⚠ у таблиці - через derive()
        break;
      }
      case "weather":
        data.weather = { ...d, t };
        mark("weather");
        break;
      default:
        break; // невідомий топік - ігноруємо (сумісність уперед)
    }
  }

  // Похідні значення на момент clock: піт-лейн за геометрією, сход/гараж,
  // застарілі машини, сині прапори й попередження. Таблиця перерендерюється
  // лише якщо щось із цього змінилось.
  function derive() {
    const clock = playback.clock;
    if (clock == null) return;
    const g = data.track?.geometry || null;
    const inPit = {}, gone = {}, stale = {}, blueFlag = {}, warning = {};
    const out = {};
    for (const n of data.driverNumbers) {
      const last = lastLocationAt[n];
      const ref = last ?? data.watchStart;
      const age = ref == null ? 0 : clock - ref;
      gone[n] = age > THRESHOLDS.goneMs;
      stale[n] = last != null && age > THRESHOLDS.staleLocationMs;
      inPit[n] = false;
      if (g && last != null && !gone[n]) {
        const ring = trails.get(n);
        const i = ring.idx(ring.size - 1);
        projectOnTrack(g, ring.x[i], ring.y[i], { hint: projHint.get(n) ?? -1, out });
        projHint.set(n, out.index);
        inPit[n] = out.distance > PIT_LANE_DISTANCE;
      }
    }
    for (const m of data.raceControl) {
      if (m.t == null || clock - m.t > THRESHOLDS.warningMs) break;
      const age = clock - m.t;
      if (age < 0) continue;
      if (m.flag === "BLUE" && m.driver_number != null && age <= THRESHOLDS.blueFlagMs) blueFlag[m.driver_number] = true;
      if (m.flag !== "BLUE" && (PENALTY_RE.test(m.message || "") || m.flag === "BLACK AND WHITE")) {
        const cars = m.driver_number != null ? [m.driver_number] : carsMentioned(m.message);
        for (const c of cars) if (!warning[c]) warning[c] = m;
      }
    }
    const prev = data.derived;
    const next = { inPit, gone, stale, blueFlag, warning };
    let changed = false;
    for (const k of Object.keys(next)) {
      if (shallowEqualMaps(prev[k], next[k])) next[k] = prev[k];
      else changed = true;
    }
    if (changed) {
      data.derived = next;
      mark("table");
    }
  }

  // Частка кола для нових семплів car_data (для траси швидкості, W6):
  // найближчий за часом location цього пілота → проєкція на контур.
  function resolveFractions() {
    const g = data.track?.geometry;
    const clock = playback.clock;
    const tmp = {};
    const proj = {};
    for (const [n, tel] of telemetry) {
      const ring = trails.get(n);
      // Нерозв'язані семпли завжди утворюють «хвіст» масиву (розв'язуються за часом).
      let k = tel.current.length;
      while (k > 0 && tel.current[k - 1].f === undefined) k--;
      for (let i = k; i < tel.current.length; i++) {
        const s = tel.current[i];
        if (!g || !ring || !ring.size) {
          if (!g || (clock != null && clock - s.t > THRESHOLDS.fractionGiveUpMs)) s.f = -1;
          continue;
        }
        if (ring.lastT() < s.t) {
          if (clock != null && clock - s.t > THRESHOLDS.fractionGiveUpMs) s.f = -1;
          continue;
        }
        ring.sample(s.t, tmp, THRESHOLDS.maxInterpolationGapMs);
        if (!tmp.ok || tmp.gap || tmp.age > 0.5) {
          s.f = -1;
          continue;
        }
        projectOnTrack(g, tmp.x, tmp.y, { out: proj });
        s.f = proj.distance > PIT_LANE_DISTANCE ? -1 : proj.fraction;
      }
    }
  }

  function applyBatch(msg) {
    const clock = parseTime(msg.clock);
    const batchClock = clock ?? playback.clock;
    for (const e of msg.events || []) applyEvent(e, batchClock);
    const t = now();
    playback = { ...playback, clock: clock ?? playback.clock, clockRecvAt: t, lastBatchAt: t };
    if (msg.catchup) {
      playback.epoch++;
      tableInstant = true;
      data.watchStart = clock ?? data.watchStart;
      mark(...CHANNELS.filter((c) => c !== "focus"));
    }
    derive();
    resolveFractions();
    // Перший звичайний батч зі зміною таблиці після catch-up знімає «миттєвий» режим.
    if (!msg.catchup && tableInstant && dirty.has("table")) tableInstant = false;
    mark("playback");
  }

  // --- публічний API ---
  const store = {
    /** Повідомлення протоколу від джерела (session | batch | state | end | error). */
    receive(msg) {
      if (!msg || typeof msg !== "object") return;
      switch (msg.type) {
        case "session":
          applySession(msg);
          scheduleFlush(true);
          return;
        case "batch":
          applyBatch(msg);
          scheduleFlush(!!msg.catchup);
          return;
        case "state": {
          const clock = parseTime(msg.clock);
          playback = {
            ...playback,
            paused: !!msg.paused,
            speed: msg.speed != null ? clampSpeed(msg.speed) : playback.speed,
            clock: clock ?? playback.clock,
            clockRecvAt: now(),
          };
          mark("playback");
          scheduleFlush(true);
          return;
        }
        case "end": {
          const clock = parseTime(msg.clock);
          playback = { ...playback, ended: true, clock: clock ?? playback.clock, clockRecvAt: now() };
          derive();
          mark("playback");
          scheduleFlush(true);
          return;
        }
        case "error":
          playback = { ...playback, error: msg.detail ?? null };
          mark("playback");
          scheduleFlush(true);
          return;
        default:
          return;
      }
    },

    /** Стан з'єднання від джерела: {status, error, reconnect, connId, seeking, mode}. */
    setConnection(patch) {
      playback = { ...playback, ...patch };
      mark("playback");
      scheduleFlush(true);
    },

    /** Оптимістична пауза: локальний годинник зупиняється одразу, до відповіді state. */
    setPaused(paused) {
      const t = now();
      const local = store.getClockLocal(t);
      playback = { ...playback, paused: !!paused, clock: local ?? playback.clock, clockRecvAt: t };
      mark("playback");
      scheduleFlush(true);
    },

    /** Оптимістична зміна швидкості (годинник перекладається без стрибка). */
    setSpeed(speed) {
      const t = now();
      const local = store.getClockLocal(t);
      playback = { ...playback, speed: clampSpeed(speed), clock: local ?? playback.clock, clockRecvAt: t };
      mark("playback");
      scheduleFlush(true);
    },

    /** Перемотування почалось: старі дані лишаються на екрані (приглушено) до нової session. */
    beginSeek(offsetSeconds) {
      const target = data.sessionStart != null ? data.sessionStart + offsetSeconds * 1000 : null;
      playback = { ...playback, seeking: { offset: offsetSeconds, target }, ended: false };
      mark("playback");
      scheduleFlush(true);
    },

    /** Повне скидання (зміна сесії/джерела). Фокус зберігається, якщо keepUi. */
    reset({ keepUi = true } = {}) {
      data = emptyData();
      resetBuffers();
      const epoch = playback.epoch + 1;
      playback = { ...initialPlayback(), epoch, speed: playback.speed };
      if (!keepUi) ui = { focus: null, rival: null };
      tableInstant = true;
      caches = { tower: null, towerKey: -1, trace: new Map() };
      mark(...CHANNELS);
      scheduleFlush(true);
    },

    // --- спільний UI-стан ---
    setFocus(n) {
      const v = n == null || !data.drivers[n] ? null : Number(n);
      if (v === ui.focus) return;
      ui = { focus: v, rival: ui.rival === v ? null : ui.rival };
      mark("focus");
      scheduleFlush(true);
    },
    toggleFocus(n) {
      store.setFocus(ui.focus === Number(n) ? null : n);
    },
    setRival(n) {
      const v = n == null || !data.drivers[n] || Number(n) === ui.focus ? null : Number(n);
      if (v === ui.rival) return;
      ui = { ...ui, rival: v };
      mark("focus");
      scheduleFlush(true);
    },

    // --- підписки ---
    /** subscribe("table", cb) або subscribe(["table", "focus"], cb) → відписка. */
    subscribe(channels, cb) {
      const list = Array.isArray(channels) ? channels : [channels];
      for (const c of list) {
        if (!listeners[c]) throw new Error(`Невідомий канал live-стору: ${c}`);
        listeners[c].add(cb);
      }
      return () => {
        for (const c of list) listeners[c].delete(cb);
      };
    },
    /** Сума версій каналів - змінюється при кожному сповіщенні будь-якого з них. */
    getVersion(channels) {
      const list = Array.isArray(channels) ? channels : [channels];
      let v = 0;
      for (const c of list) v += versions[c];
      return v;
    },
    /** Негайно розіслати відкладені сповіщення (тести, оптимістичні дії). */
    flush,

    /**
     * Незмінний знімок стану (оновлюється при кожному сповіщенні). Контейнери
     * всередині - copy-on-write, тож їх можна порівнювати через Object.is.
     */
    getState() {
      if (!snapshot) snapshot = { ...data, playback, focus: ui.focus, rival: ui.rival };
      return snapshot;
    },

    // --- похідні для таблиці ---
    /** Рядки timing tower (кешовано на версію каналу table). Див. README. */
    getTower() {
      const key = versions.table + versions.meta * 1e6;
      if (caches.tower && caches.towerKey === key) return caches.tower;
      caches.tower = buildTower(store.getState(), tableInstant);
      caches.towerKey = key;
      return caches.tower;
    },

    // --- імперативні аксесори для Canvas (rAF) ---
    /**
     * Локальний плавний годинник: lastClock + (now − tRecv) × speed; на паузі,
     * під час завантаження/буферизації/кінця заморожений. Монотонний у межах epoch.
     */
    getClockLocal(t = now()) {
      const p = playback;
      if (p.clock == null) return null;
      let v = p.clock;
      if (!p.paused && p.status === "playing" && !p.ended && !p.seeking) {
        v += Math.min(Math.max(0, t - p.clockRecvAt), 1000) * p.speed;
        if (data.replay?.endMs != null) v = Math.min(v, data.replay.endMs);
      }
      if (lastLocalEpoch === p.epoch && lastLocal != null && v < lastLocal && lastLocal - v < 5000 * p.speed && !p.paused) v = lastLocal;
      lastLocal = v;
      lastLocalEpoch = p.epoch;
      return v;
    },
    /** Час відмальовки карти: clockLocal − max(0.6 с, 0.4 × speed). */
    getRenderTime(t = now()) {
      const c = store.getClockLocal(t);
      return c == null ? null : c - renderDelayMs(playback.speed);
    },
    /**
     * Машини на момент renderTime (мс epoch) з інтерполяцією location.
     * ПОВЕРТАЄ МАСИВ І ОБ'ЄКТИ, ЩО ПЕРЕВИКОРИСТОВУЮТЬСЯ між викликами (без
     * алокацій у кадрі) - не зберігайте посилання на них.
     * Елемент: {driverNumber, ok, x, y, age (с), gap, stale, gone, inPit,
     *           trackDistance, lapFraction, snapX, snapY}.
     */
    getCarsAt: (() => {
      const pool = [];
      const tmp = {};
      return function getCarsAt(renderTime) {
        const nums = data.driverNumbers;
        const g = data.track?.geometry || null;
        pool.length = nums.length;
        for (let i = 0; i < nums.length; i++) {
          const n = nums[i];
          const c = pool[i] || (pool[i] = {});
          c.driverNumber = n;
          const ring = trails.get(n);
          c.ok = false;
          c.x = c.y = c.snapX = c.snapY = 0;
          c.age = null;
          c.gap = false;
          c.trackDistance = null;
          c.lapFraction = null;
          c.gone = !!data.derived.gone[n];
          c.stale = false;
          c.inPit = false;
          if (!ring || !ring.size || renderTime == null) continue;
          ring.sample(renderTime, c, THRESHOLDS.maxInterpolationGapMs);
          if (!c.ok) continue;
          c.stale = c.age * 1000 > THRESHOLDS.staleLocationMs;
          c.gone = c.gone || c.age * 1000 > THRESHOLDS.goneMs;
          if (g) {
            projectOnTrack(g, c.x, c.y, { hint: projHint.get(n) ?? -1, out: tmp });
            c.trackDistance = tmp.distance;
            c.lapFraction = tmp.fraction;
            c.snapX = tmp.x;
            c.snapY = tmp.y;
            c.inPit = tmp.distance > PIT_LANE_DISTANCE;
          } else {
            c.snapX = c.x;
            c.snapY = c.y;
          }
        }
        return pool;
      };
    })(),
    /** Кільцевий буфер location пілота (TimeRing) або null - для «хвоста». */
    getTrail(n) {
      return trails.get(Number(n)) || null;
    },
    /** Контур: {points, geometry} або null. */
    getTrack() {
      return data.track;
    },
    /** Розріджені побачені точки location [[x, y], ...] (новий масив) - для bbox/автоповороту з піт-лейном. */
    getSeenPoints() {
      const out = new Array(seen.size);
      for (let i = 0; i < seen.size; i++) out[i] = [seen.xs[i], seen.ys[i]];
      return out;
    },
    /** Мс epoch останнього location пілота або null. */
    getLastLocationAt(n) {
      return lastLocationAt[n] ?? null;
    },
    /**
     * Траса швидкості (W6): {lapNumber, lapStart, partial, current: [{f, t, speed,
     * throttle, brake}], previous: [...], previousLapNumber}. f - частка кола 0..1.
     * null, якщо телеметрії пілота ще немає. Кешується на версію каналу telemetry.
     */
    getSpeedTrace(n) {
      const num = Number(n);
      const cached = caches.trace.get(num);
      if (cached && cached.v === versions.telemetry) return cached.value;
      const tel = telemetry.get(num);
      let value = null;
      if (tel) {
        const cur = [];
        for (const s of tel.current) {
          const f = unwrapLapFraction(s.f, tel.lapStart != null ? (s.t - tel.lapStart) / 1000 : null, null);
          if (f != null) cur.push({ f, t: s.t, speed: s.speed, throttle: s.throttle, brake: s.brake });
        }
        const prev = [];
        const pl = tel.previousLap;
        for (const s of tel.previous) {
          const f = unwrapLapFraction(s.f, pl?.start != null ? (s.t - pl.start) / 1000 : null, pl ? (pl.end - s.t) / 1000 : null);
          if (f != null) prev.push({ f, t: s.t, speed: s.speed, throttle: s.throttle, brake: s.brake });
        }
        const firstT = tel.current[0]?.t;
        value = {
          lapNumber: tel.lapNumber,
          lapStart: tel.lapStart,
          partial: tel.lapStart == null || (firstT != null && firstT - tel.lapStart > 1500),
          current: cur,
          previous: prev,
          previousLapNumber: pl?.lapNumber ?? null,
        };
      }
      caches.trace.set(num, { v: versions.telemetry, value });
      return value;
    },
    /** Сирі семпли car_data поточного й попереднього кола (мутабельні - лише читати). */
    getTelemetryLap(n) {
      return telemetry.get(Number(n)) || null;
    },
  };
  return store;
}

/**
 * Рядки таблиці позицій. Чиста функція від знімка стану - тож її можна
 * тестувати й перевикористовувати.
 */
export function buildTower(state, instant = false) {
  const { drivers, driverNumbers, position, intervals, laps, stints, pits, personalBest, best, derived, session } = state;
  const isRace = session?.session_type === "Race";
  const bestLap = best.lap?.time ?? null;
  const rows = driverNumbers.map((n) => {
    const lapArr = laps[n] || [];
    const lastLap = lapArr.length ? lapArr[lapArr.length - 1] : null;
    const lapsCompleted = lastLap?.lap_number ?? 0;
    const stint = currentStint(stints[n]);
    const pb = personalBest[n];
    const lastLapTime = isNum(lastLap?.lap_duration) ? lastLap.lap_duration : null;
    const iv = intervals[n];
    const pitList = pits[n] || [];
    return {
      driverNumber: n,
      driver: drivers[n],
      position: position[n]?.position ?? null,
      gapToLeader: iv ? iv.gap_to_leader : null,
      interval: iv ? iv.interval : null,
      intervalsAt: iv?.t ?? null,
      isLeader: position[n]?.position === 1,
      lapsCompleted,
      currentLap: lapsCompleted + 1,
      lastLap,
      lastLapTime,
      lastLapIsPit: isPitLap(lastLap),
      lastLapIsSessionBest: lastLapTime != null && lastLapTime === bestLap,
      lastLapIsPersonalBest: lastLapTime != null && lastLapTime === pb?.lap,
      bestLapTime: pb?.lap ?? null,
      hasSessionBest: best.lap?.driverNumber === n,
      gapToBest: pb?.lap != null && bestLap != null ? pb.lap - bestLap : null,
      stint,
      compound: stint?.compound ?? null,
      tyreAge: tyreAge(stint, lapsCompleted),
      usedSet: isUsedSet(stint),
      pits: pitList,
      pitCount: pitList.length,
      lastPit: pitList.length ? pitList[pitList.length - 1] : null,
      inPit: !!derived.inPit[n],
      gone: !!derived.gone[n],
      stale: !!derived.stale[n],
      blueFlag: !!derived.blueFlag[n],
      warning: derived.warning[n] || null,
    };
  });
  rows.sort((a, b) => {
    const pa = a.position ?? Infinity;
    const pb = b.position ?? Infinity;
    if (pa !== pb) return pa - pb;
    const ga = isNum(a.gapToLeader) ? a.gapToLeader : Infinity;
    const gb = isNum(b.gapToLeader) ? b.gapToLeader : Infinity;
    if (ga !== gb) return ga - gb;
    return a.driverNumber - b.driverNumber;
  });
  const leader = rows.find((r) => r.isLeader) || null;
  return {
    rows,
    isRace,
    hasIntervals: Object.keys(intervals).length > 0,
    leaderNumber: leader?.driverNumber ?? null,
    leaderLap: leader ? leader.currentLap : null,
    bestLap: best.lap,
    bestSectors: best.sectors,
    epoch: state.playback.epoch,
    instant,
  };
}
