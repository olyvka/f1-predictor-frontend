// React-хуки екрана Live. Віджети читають дані ЛИШЕ через ці хуки (та
// імперативні аксесори стору для Canvas). Повний контракт - src/live/README.md.
//
// Як працює оновлення: кожен хук підписаний на свої канали стору
// (useSyncExternalStore). Стор сповіщає канал не частіше ніж раз на batch
// (~4/с), а location/car_data окремими подіями не будять React взагалі.

import { useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LiveContext } from "./context";
import { api } from "../api/client";
import { useApiQuery } from "../hooks/useApiQuery";
import { matchPredictions } from "./predictions";
import { currentStint, tyreAge } from "./tyres";
import { bannerFor } from "./trackStatus";

const EMPTY = Object.freeze([]);

function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("Live-хуки працюють лише всередині <LiveProvider>");
  return ctx;
}

/** Стор (для імперативних аксесорів: getCarsAt, getRenderTime, getSpeedTrace…). */
export function useLiveStore() {
  return useLive().store;
}

/** Джерело (ReplaySource / FixtureSource / LiveSource) або null, поки створюється. */
export function useLiveSource() {
  return useLive().source;
}

/** Параметри адреси: {year, round, session, sourceKind}. */
export function useLiveParams() {
  return useLive().params;
}

/** Поверхнева рівність об'єктів/масивів - для селекторів, що збирають новий об'єкт. */
export function shallowEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  for (const k of ka) if (!Object.is(a[k], b[k])) return false;
  return true;
}

/**
 * Базовий хук: selector(state, store) перераховується лише при сповіщенні
 * вказаних каналів; якщо isEqual(старе, нове) - компонент не ререндериться.
 */
export function useLiveSelector(channels, selector, isEqual = Object.is) {
  const store = useLiveStore();
  const key = Array.isArray(channels) ? channels.join("|") : channels;
  const subscribe = useCallback((cb) => store.subscribe(key.split("|"), cb), [store, key]);
  const cache = useRef(null);
  const getSnapshot = () => {
    const version = store.getVersion(key.split("|"));
    const c = cache.current;
    if (c && c.store === store && c.version === version && c.selector === selector) return c.value;
    const next = selector(store.getState(), store);
    if (c && c.store === store && isEqual(c.value, next)) {
      cache.current = { store, version, selector, value: c.value };
      return c.value;
    }
    cache.current = { store, version, selector, value: next };
    return next;
  };
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- сесія і пілоти (канал meta: змінюється лише з новою session) ---

/**
 * {mode, session, sessionStart, replay, drivers ({[n]: Driver}), driverList (за номером),
 *  track ({points, geometry} | null), isRace, ready (session вже прийшла)}
 */
export function useSession() {
  return useLiveSelector(
    "meta",
    (s) => ({
      mode: s.mode,
      session: s.session,
      sessionStart: s.sessionStart,
      replay: s.replay,
      drivers: s.drivers,
      driverList: s.driverNumbers.map((n) => s.drivers[n]),
      track: s.track,
      isRace: s.session?.session_type === "Race",
      ready: !!s.session,
    }),
    (a, b) => a.session === b.session && a.drivers === b.drivers && a.track === b.track && a.replay === b.replay && a.mode === b.mode
  );
}

/** Driver або null: {...поля OpenF1, number, acronym, color (контраст ≥3:1), rawColor, teammate, isSecondTeammate}. */
export function useDriver(n) {
  return useLiveSelector("meta", (s) => (n == null ? null : s.drivers[n] || null));
}

// --- відтворення (канал playback: кожен batch ~4/с і кожна дія) ---

/**
 * Стан відтворення + дії. Дії оптимістичні (годинник зупиняється одразу).
 * {mode, status, error, reconnect, paused, speed, clock, sessionStart, replayStart,
 *  replayEnd, seeking, ended, epoch, lastEventAt, lastBatchAt, capabilities,
 *  pause(), resume(), togglePause(), setSpeed(n), seek(offsetSeconds), seekToTime(ms), retry()}
 */
export function useReplay() {
  const { source } = useLive();
  const state = useLiveSelector(
    ["playback", "meta"],
    (s) => ({
      mode: s.playback.mode || s.mode,
      status: s.playback.status,
      error: s.playback.error,
      reconnect: s.playback.reconnect,
      paused: s.playback.paused,
      speed: s.playback.speed,
      clock: s.playback.clock,
      sessionStart: s.sessionStart,
      replayStart: s.replay?.startMs ?? null,
      replayEnd: s.replay?.endMs ?? null,
      seeking: s.playback.seeking,
      ended: s.playback.ended,
      epoch: s.playback.epoch,
      lastEventAt: s.lastEventAt,
      lastBatchAt: s.playback.lastBatchAt,
    }),
    shallowEqual
  );
  const srcRef = useRef(source);
  srcRef.current = source;
  const actions = useMemo(
    () => ({
      pause: () => srcRef.current?.pause(),
      resume: () => srcRef.current?.resume(),
      togglePause: () => srcRef.current?.togglePause(),
      setSpeed: (v) => srcRef.current?.setSpeed(v),
      seek: (offsetSeconds) => srcRef.current?.seek(offsetSeconds),
      retry: () => srcRef.current?.retry(),
    }),
    []
  );
  const capabilities = source?.capabilities || { pause: false, speed: false, seek: false };
  const seekToTime = useCallback(
    (ms) => {
      if (state.sessionStart != null) actions.seek((ms - state.sessionStart) / 1000);
    },
    [actions, state.sessionStart]
  );
  return { ...state, capabilities, ...actions, seekToTime };
}

/**
 * Плавний локальний годинник сесії (мс epoch) для тексту (таймер, шкала):
 * перечитується кожні intervalMs, ререндер лише якщо значення змінилось.
 * Для Canvas використовуйте store.getClockLocal() прямо в rAF.
 */
export function useClockLocal(intervalMs = 250) {
  const store = useLiveStore();
  const [value, setValue] = useState(() => store.getClockLocal());
  useEffect(() => {
    const read = () => setValue(store.getClockLocal());
    read();
    const id = setInterval(read, intervalMs);
    const unsub = store.subscribe("playback", read);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [store, intervalMs]);
  return value;
}

// --- таблиця (канал table: позиції, інтервали, кола, стінти, піти, похідні) ---

/**
 * {rows: TowerRow[] (за позицією), isRace, hasIntervals, leaderNumber, leaderLap,
 *  bestLap, bestSectors, epoch, instant}. Формат TowerRow - README.
 */
export function useTower() {
  return useLiveSelector(["table", "meta"], (_s, store) => store.getTower());
}

/** Деталі одного пілота: кола, стінти, піти, позиція, інтервали, особисті найкращі. */
export function useDriverDetail(n) {
  return useLiveSelector(
    ["table", "meta"],
    (s) => {
      if (n == null || !s.drivers[n]) return null;
      const laps = s.laps[n] || EMPTY;
      const lastLap = laps.length ? laps[laps.length - 1] : null;
      const stint = currentStint(s.stints[n]);
      return {
        driver: s.drivers[n],
        position: s.position[n]?.position ?? null,
        intervals: s.intervals[n] || null,
        laps,
        lastLap,
        stints: s.stints[n] || EMPTY,
        stint,
        tyreAge: tyreAge(stint, lastLap?.lap_number ?? 0),
        pits: s.pits[n] || EMPTY,
        personalBest: s.personalBest[n] || null,
        sessionBest: s.best,
        inPit: !!s.derived.inPit[n],
        gone: !!s.derived.gone[n],
      };
    },
    shallowEqual
  );
}

// --- фокус (спільний стан таблиця ↔ карта ↔ телеметрія) ---

/** {focus, rival, setFocus(n|null), toggleFocus(n), setRival(n|null), clear()} */
export function useFocus() {
  const store = useLiveStore();
  const sel = useLiveSelector("focus", (s) => ({ focus: s.focus, rival: s.rival }), shallowEqual);
  const actions = useMemo(
    () => ({
      setFocus: (n) => store.setFocus(n),
      toggleFocus: (n) => store.toggleFocus(n),
      setRival: (n) => store.setRival(n),
      clear: () => {
        store.setFocus(null);
        store.setRival(null);
      },
    }),
    [store]
  );
  return { ...sel, ...actions };
}

/** Пілот для панелі фокусу: вибраний або лідер. {number, isFallback} */
export function useFocusDriver() {
  return useLiveSelector(
    ["focus", "table"],
    (s, store) => {
      if (s.focus != null) return { number: s.focus, isFallback: false };
      return { number: store.getTower().leaderNumber, isFallback: true };
    },
    shallowEqual
  );
}

// --- телеметрія (канал telemetry: раз на batch, якщо прийшла car_data) ---

/** Остання car_data пілота: {speed, throttle, brake, n_gear, rpm, date, t} або null. DRS не використовувати. */
export function useCarData(n) {
  return useLiveSelector("telemetry", (s) => (n == null ? null : s.carData[n] || null));
}

/** Траса швидкості поточного/попереднього кола за часткою кола (store.getSpeedTrace). */
export function useSpeedTrace(n) {
  return useLiveSelector(["telemetry", "meta"], (_s, store) => (n == null ? null : store.getSpeedTrace(n)));
}

// --- race control, статус траси, погода ---

/** {messages (новіші першими, ≤200), trackStatus} */
export function useRaceControl() {
  return useLiveSelector("rc", (s) => ({ messages: s.raceControl, trackStatus: s.trackStatus }), shallowEqual);
}

/** {status (повний стан, див. trackStatus.js), banner (що показати банером або null)} */
export function useTrackStatus() {
  return useLiveSelector("rc", (s) => ({ status: s.trackStatus, banner: bannerFor(s.trackStatus) }), (a, b) => a.status === b.status);
}

/** Остання погода або null: {air_temperature, track_temperature, humidity, pressure, rainfall, wind_speed, wind_direction, t}. */
export function useWeather() {
  return useLiveSelector("weather", (s) => s.weather);
}

// --- REST-дані етапу ---

/** /api/circuit-facts/{year}/{round}: {data, loading, error, typicalLaps}. */
export function useCircuitFacts() {
  const { year, round } = useLiveParams();
  const q = useApiQuery(() => api.getCircuitFacts(year, round), [year, round]);
  return { ...q, typicalLaps: q.data?.typical_laps ?? null };
}

/**
 * Лічильник кіл: {current (коло лідера, обмежене total), total (typical_laps лише
 * для гонки/спринту, інакше null), isRace}. У кваліфікації/практиці «Коло X / Y» не має сенсу.
 */
export function useLapCounter() {
  const { typicalLaps } = useCircuitFacts();
  const { isRace } = useSession();
  const leaderLap = useLiveSelector(["table", "meta"], (_s, store) => store.getTower().leaderLap);
  const total = isRace ? typicalLaps : null;
  const current = leaderLap == null ? null : total ? Math.min(leaderLap, total) : leaderLap;
  return { current, total, isRace };
}

/**
 * Прогноз моделі для пілотів потоку (L12): /api/analysis + /api/event-standings.
 * Перший запит по етапу може тренувати модель (довго) - тому enabled.
 * {status: "idle"|"loading"|"ready"|"error", error, byNumber, unmatched, analysis}
 */
export function usePredictions({ enabled = true } = {}) {
  const { year, round } = useLiveParams();
  const { driverList, ready } = useSession();
  const analysis = useApiQuery(() => api.getAnalysis(year, round), [year, round], { enabled });
  const standings = useApiQuery(() => api.getEventStandings(year, round), [year, round], { enabled });
  const matched = useMemo(() => {
    if (!analysis.data || !ready) return null;
    const res = matchPredictions(analysis.data.predictions, standings.data?.drivers || [], driverList);
    if (res.unmatched.length) console.warn("[live] прогноз без пілота в потоці:", res.unmatched.map((p) => p.driver));
    return res;
  }, [analysis.data, standings.data, driverList, ready]);
  const status = !enabled ? "idle" : analysis.error ? "error" : matched ? "ready" : "loading";
  const { refetch: refetchAnalysis } = analysis;
  const { refetch: refetchStandings } = standings;
  // "Спробувати ще" після таймауту/помилки (перший запит по етапу тренує модель).
  const refetch = useCallback(() => {
    refetchAnalysis();
    refetchStandings();
  }, [refetchAnalysis, refetchStandings]);
  return { status, error: analysis.error, byNumber: matched?.byNumber || {}, unmatched: matched?.unmatched || EMPTY, analysis: analysis.data, refetch };
}
