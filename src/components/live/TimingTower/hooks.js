// Хуки руху й стану timing tower (агент A). Дані - лише з src/live/hooks.js;
// тут тільки показ: коли переставляти рядки, як їх анімувати, що оголосити.
//
// Правило фундаменту (README «Анімації: epoch та instant»): якщо tower.instant
// або epoch змінився з минулого рендера - жодних переходів і підсвіток.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { FAST_SPEED, MOTION, mergeArrows, nextArrowExpiry, orderDeltas, orderKey, positionAnnouncement, reorderDelay, sameMembers } from "./logic";

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// --- prefers-reduced-motion ---------------------------------------------------

const RM_QUERY = "(prefers-reduced-motion: reduce)";
function rmSubscribe(cb) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const m = window.matchMedia(RM_QUERY);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}
const rmRead = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(RM_QUERY).matches : false);

export function useReducedMotion() {
  return useSyncExternalStore(rmSubscribe, rmRead, () => false);
}

// --- localStorage з try/catch (приватний режим) ---------------------------------

export function useStoredState(key, initial, validate = () => true) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) {
        const v = JSON.parse(raw);
        if (validate(v)) return v;
      }
    } catch {
      /* немає доступу до сховища */
    }
    return initial;
  });
  const set = useCallback(
    (v) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* немає доступу до сховища */
      }
    },
    [key]
  );
  return [value, set];
}

// --- порядок рядків з буфером і тротлінгом --------------------------------------

/**
 * Порядок, який зараз показує таблиця. Нові порядки застосовуються:
 *   - миттєво й без руху: instant, змінився epoch, інший набір пілотів;
 *   - інакше через буфер MOTION.mergeWindow (обмін двох місць = дві події
 *     position → один reorder), а на ×5+ не частіше ніж раз на секунду.
 * Повертає {order, seq, animate, from}: seq росте з кожною перестановкою,
 * animate - чи можна її анімувати, from - попередній порядок.
 */
export function useTowerOrder(order, { instant, epoch, speed }) {
  const key = orderKey(order);
  const [applied, setApplied] = useState(() => ({ key, order, seq: 0, animate: false, from: null, epoch }));
  const latest = useRef(null);
  latest.current = { key, order, instant, epoch };
  const timer = useRef(null);
  const pendingSince = useRef(null);
  const lastAppliedAt = useRef(null);

  // До відмальовки: миттєві випадки не мають показати навіть кадру старого порядку.
  useLayoutEffect(() => {
    const immediate = instant || epoch !== applied.epoch || !sameMembers(applied.order, order);
    if (immediate) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendingSince.current = null;
      if (applied.key !== key || applied.epoch !== epoch) {
        setApplied((prev) => ({ key, order, seq: prev.seq + 1, animate: false, from: prev.order, epoch }));
      }
      return;
    }
    if (applied.key === key) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendingSince.current = null;
      return;
    }
    if (timer.current) return; // уже чекаємо: таймер візьме найсвіжіший порядок
    const t = now();
    if (pendingSince.current == null) pendingSince.current = t;
    const delay = reorderDelay({ now: t, pendingSince: pendingSince.current, lastAppliedAt: lastAppliedAt.current, speed });
    timer.current = setTimeout(() => {
      timer.current = null;
      pendingSince.current = null;
      const l = latest.current;
      lastAppliedAt.current = now();
      setApplied((prev) => {
        if (prev.key === l.key && prev.epoch === l.epoch) return prev;
        const animate = !l.instant && prev.epoch === l.epoch && sameMembers(prev.order, l.order);
        return { key: l.key, order: l.order, seq: prev.seq + 1, animate, from: prev.order, epoch: l.epoch };
      });
    }, delay);
  }, [key, order, instant, epoch, speed, applied]);

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);
  return applied;
}

// --- FLIP, підсвітка рядків і стрілки ▲▼ ---------------------------------------

/**
 * Анімує перестановку (FLIP через Web Animations: translateY → 0 за 300 мс),
 * підсвічує рядки, що виграли/втратили місця (1.5 с; на ×5+ 0.4 с), і веде
 * стрілки ▲N/▼N (5 с; на ×5+ без стрілок). Без руху при reduced motion
 * (лишається лише підсвітка). Повертає {arrows: {n: {delta, until}}}.
 * tbodyRef - <tbody>, рядки з data-n.
 */
export function useRowMotion(tbodyRef, applied, { speed, reducedMotion }) {
  const [arrows, setArrows] = useState({});
  const fast = speed >= FAST_SPEED;

  useLayoutEffect(() => {
    if (!applied.animate) {
      // Скидання стану (перемотування, catch-up): гасимо стрілки й незавершені анімації.
      setArrows((a) => (Object.keys(a).length ? {} : a));
      const body = tbodyRef.current;
      if (body) for (const el of body.children) for (const an of el.getAnimations?.() || []) an.cancel();
      return;
    }
    const body = tbodyRef.current;
    if (!body) return;
    const deltas = orderDeltas(applied.from, applied.order);
    const moved = Object.keys(deltas);
    if (!moved.length) return;
    const rows = new Map();
    for (const el of body.children) if (el.dataset.n) rows.set(el.dataset.n, el);
    const rowH = body.firstElementChild?.offsetHeight || 32;
    const tint = fast ? MOTION.tintFast : MOTION.tint;
    for (const n of moved) {
      const el = rows.get(n);
      if (!el) continue;
      const d = deltas[n];
      if (!reducedMotion) {
        // Якщо рядок ще їде з минулої перестановки - стартуємо з його поточного зсуву.
        let carry = 0;
        for (const an of el.getAnimations()) {
          if (an.id === "lt-flip") {
            const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === "none" ? undefined : getComputedStyle(el).transform);
            carry = m.m42;
            an.cancel();
          }
        }
        const from = d * rowH + carry;
        const flip = el.animate([{ transform: `translateY(${from}px)` }, { transform: "translateY(0)" }], {
          duration: MOTION.reorder,
          easing: "ease-out",
        });
        flip.id = "lt-flip";
      }
      if (el.dataset.gone !== "true") {
        for (const an of el.getAnimations()) if (an.id === "lt-tint") an.cancel();
        const tintAn = el.animate([{ backgroundColor: d > 0 ? "var(--color-row-gain)" : "var(--color-row-loss)" }], {
          duration: tint,
          easing: "ease-in",
        });
        tintAn.id = "lt-tint";
      }
    }
    if (!fast) setArrows((prev) => mergeArrows(prev, deltas, Date.now()));
  }, [applied, tbodyRef, fast, reducedMotion]);

  // На ×5+ стрілок немає (§5.8) - прибираємо, якщо швидкість щойно зросла.
  useEffect(() => {
    if (fast) setArrows((a) => (Object.keys(a).length ? {} : a));
  }, [fast]);

  // Один таймер на найближче згасання.
  useEffect(() => {
    const next = nextArrowExpiry(arrows);
    if (next == null) return;
    const id = setTimeout(() => setArrows((prev) => mergeArrows(prev, {}, Date.now())), Math.max(0, next - Date.now()) + 20);
    return () => clearTimeout(id);
  }, [arrows]);

  return arrows;
}

/**
 * Одноразове світіння клітинки останнього кола (600 мс), коли в пілота нове
 * фіолетове/зелене коло. Не на ×5+, не при reduced motion, не після скидання стану.
 * rows - рядки tower; kinds - n → вид клітинки (lastLapKind).
 */
export function useLapGlow(tbodyRef, rows, { epoch, instant, speed, reducedMotion, enabled }) {
  const seen = useRef(new Map());
  const seenEpoch = useRef(epoch);
  useLayoutEffect(() => {
    const allow = enabled && !instant && seenEpoch.current === epoch && speed < FAST_SPEED && !reducedMotion;
    seenEpoch.current = epoch;
    const body = tbodyRef.current;
    for (const r of rows) {
      const lap = r.lastLap?.lap_number ?? null;
      const prev = seen.current.get(r.driverNumber);
      seen.current.set(r.driverNumber, lap);
      if (!allow || !body || lap == null || prev === lap || prev === undefined) continue;
      if (!(r.lastLapIsSessionBest || r.lastLapIsPersonalBest) || r.lastLapIsPit) continue;
      const cell = body.querySelector(`[data-n="${r.driverNumber}"] [data-glow]`);
      cell?.animate(
        [{ boxShadow: `inset 0 0 0 2px ${r.lastLapIsSessionBest ? "var(--color-timing-purple)" : "var(--color-timing-green)"}` }, { boxShadow: "inset 0 0 0 2px transparent" }],
        { duration: MOTION.lapGlow, easing: "ease-out" }
      );
    }
  }, [rows, epoch, instant, speed, reducedMotion, enabled, tbodyRef]);
}

// --- aria-live: позиція вибраного пілота, не частіше разу на 5 с ------------------

export function useFocusAnnouncer({ focusRow, epoch, instant, t }) {
  const [message, setMessage] = useState("");
  const last = useRef({ n: null, position: null, epoch, at: -Infinity, timer: null, pendingFrom: null });
  const n = focusRow?.driverNumber ?? null;
  const position = focusRow?.position ?? null;
  const name = focusRow?.driver?.full_name || focusRow?.driver?.broadcast_name || focusRow?.driver?.acronym || "";

  useEffect(() => {
    const s = last.current;
    const reset = s.n !== n || s.epoch !== epoch || instant;
    if (reset) {
      if (s.timer) clearTimeout(s.timer);
      last.current = { n, position, epoch, at: s.at, timer: null, pendingFrom: null };
      return;
    }
    if (position === s.position) return;
    const from = s.pendingFrom ?? s.position;
    s.position = position;
    const say = () => {
      const cur = last.current;
      const text = positionAnnouncement(name, cur.pendingFrom ?? from, cur.position, t);
      cur.pendingFrom = null;
      cur.timer = null;
      cur.at = now();
      if (text) setMessage(text);
    };
    const wait = s.at + MOTION.announceEvery - now();
    if (wait <= 0) {
      s.pendingFrom = from;
      say();
    } else if (!s.timer) {
      s.pendingFrom = from;
      s.timer = setTimeout(say, wait);
    }
  }, [n, position, epoch, instant, name, t]);

  useEffect(() => () => last.current.timer && clearTimeout(last.current.timer), []);
  return message;
}
