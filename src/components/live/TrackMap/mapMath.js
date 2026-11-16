// Чисті помічники карти траси (L6, LIVE_UI_RESEARCH W4): вписування з
// поворотом, кластери точок, жадібне розміщення підписів, пошук машини під
// курсором, контур, що формується з location (track == null).
//
// Функції, що викликаються в кожному кадрі (findClusters, placeLabels,
// nearestIndex), працюють лише з переданими буферами (typed arrays) і нічого не
// алокують. Решта (fitAtAngle, chooseFit) - на resize/поворот.

import { fitRotation } from "../../../live/geometry";

export const MAP_PADDING = 24; // px, W4
export const CLUSTER_RADIUS = 14; // px: ≥ 3 точки в цьому радіусі → один підпис «VER +2»
export const CLUSTER_MIN = 3;
export const HIT_RADIUS = 16; // px: клік/тап/hover
const HALF_PI = Math.PI / 2;

/**
 * Межі точок у повернутій системі (u = x·cos − y·sin, v = x·sin + y·cos).
 * sets - масив наборів [[x, y], ...] (контур, побачені точки). Порожні - пропускаються.
 * Повертає {u0, u1, v0, v1} або null, якщо точок немає.
 */
export function extentsAtAngle(sets, cos, sin) {
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const pts of sets) {
    if (!pts) continue;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const u = p[0] * cos - p[1] * sin;
      const v = p[0] * sin + p[1] * cos;
      if (u < u0) u0 = u;
      if (u > u1) u1 = u;
      if (v < v0) v0 = v;
      if (v > v1) v1 = v;
    }
  }
  return u0 === Infinity ? null : { u0, u1, v0, v1 };
}

/**
 * Вписування під заданим кутом (рад): той самий формат, що fitRotation з
 * geometry.js (працює з toScreen), плюс межі {u0, u1, v0, v1}.
 */
export function fitAtAngle(sets, angle, width, height, { padding = MAP_PADDING } = {}) {
  if (!(width > 2 * padding) || !(height > 2 * padding)) return null;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const e = extentsAtAngle(sets, cos, sin);
  if (!e) return null;
  const w = Math.max(e.u1 - e.u0, 1e-9);
  const h = Math.max(e.v1 - e.v0, 1e-9);
  const scale = Math.min((width - 2 * padding) / w, (height - 2 * padding) / h);
  return { angle, cos, sin, scale, cx: (e.u0 + e.u1) / 2, cy: (e.v0 + e.v1) / 2, width, height, padding, ...e };
}

/** Кут у [0, 2π). */
export const normAngle = (a) => ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

/**
 * Вибір вписування: автоповорот (найбільший масштаб, 0-175° кроком 5°) +
 * quarterTurns ручних поворотів на 90°. prevAutoAngle - попередній автокут:
 * лишаємо його, якщо він гірший за новий не більше ніж на `stickiness`
 * (поворот не «стрибає» від дрібних змін розміру).
 * Повертає fit з полем autoAngle або null.
 */
export function chooseFit(sets, width, height, { padding = MAP_PADDING, quarterTurns = 0, prevAutoAngle = null, stickiness = 1.04 } = {}) {
  const flat = sets.length === 1 ? sets[0] : sets.flatMap((s) => s || []);
  // minGain 1.001: беремо справді найкращий кут (з 1.02 за замовчуванням
  // симетричні траси лишаються «перекошеними» на 5-10°); від смикання при
  // resize захищає stickiness нижче.
  const best = fitRotation(flat, width, height, { padding, minGain: 1.001 });
  if (!best) return null;
  let auto = best.angle;
  if (prevAutoAngle != null) {
    const prev = fitAtAngle(sets, prevAutoAngle, width, height, { padding });
    if (prev && prev.scale * stickiness >= best.scale) auto = prevAutoAngle;
  }
  const fit = fitAtAngle(sets, normAngle(auto + quarterTurns * HALF_PI), width, height, { padding });
  if (fit) fit.autoAngle = auto;
  return fit;
}

/**
 * Чи вилазять нові точки за межі поточного вписування (з допуском tol частки
 * розміру). Без алокацій, лише читання.
 */
export function exceedsFit(fit, points, tol = 0.005) {
  if (!fit || !points) return false;
  const du = (fit.u1 - fit.u0) * tol;
  const dv = (fit.v1 - fit.v0) * tol;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const u = p[0] * fit.cos - p[1] * fit.sin;
    const v = p[0] * fit.sin + p[1] * fit.cos;
    if (u < fit.u0 - du || u > fit.u1 + du || v < fit.v0 - dv || v > fit.v1 + dv) return true;
  }
  return false;
}

/**
 * Риска старту/фінішу і стрілка напрямку в екранних координатах: a - точка
 * лінії (points[0]), b - точка трохи далі за ходом (points[3]).
 * Повертає {ax, ay, ux, uy (одиничний вздовж руху), nx, ny (нормаль)} або null.
 */
export function startFinishFrame(ax, ay, bx, by) {
  const len = Math.hypot(bx - ax, by - ay);
  if (!(len > 1e-6)) return null;
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  return { ax, ay, ux, uy, nx: -uy, ny: ux };
}

/**
 * Кластери точок (W4: ≥ 3 точки в радіусі 14 px → один підпис «VER +2»).
 * Жадібно в порядку пріоритету: найвищий ще не розподілений пілот стає
 * «головою», до нього йдуть усі нерозподілені видимі в радіусі.
 *   order[k]  - індекси машин за спаданням пріоритету (фокус → суперник → позиція);
 *   visible[i]- 1, якщо машина на карті;
 *   head[i]   ← індекс голови (сам i - голова або одинак), −1 - невидима;
 *   size[i]   ← кількість у кластері для голови (1 - одинак).
 */
export function findClusters(count, order, xs, ys, visible, head, size, radius = CLUSTER_RADIUS, minSize = CLUSTER_MIN) {
  const r2 = radius * radius;
  for (let i = 0; i < count; i++) {
    head[i] = -1;
    size[i] = 0;
  }
  for (let k = 0; k < count; k++) {
    const h = order[k];
    if (!visible[h] || head[h] !== -1) continue;
    let n = 1;
    for (let j = 0; j < count; j++) {
      if (j === h || !visible[j] || head[j] !== -1) continue;
      const dx = xs[j] - xs[h];
      const dy = ys[j] - ys[h];
      if (dx * dx + dy * dy <= r2) n++;
    }
    head[h] = h;
    if (n >= minSize) {
      size[h] = n;
      for (let j = 0; j < count; j++) {
        if (j === h || !visible[j] || head[j] !== -1) continue;
        const dx = xs[j] - xs[h];
        const dy = ys[j] - ys[h];
        if (dx * dx + dy * dy <= r2) {
          head[j] = h;
          size[j] = 0;
        }
      }
    } else {
      size[h] = 1;
    }
  }
}

// Позиції підпису навколо точки (лівий верхній кут прямокутника), у порядку
// переваги: праворуч-вгору, праворуч-вниз, ліворуч-вгору, ліворуч-вниз,
// над, під, праворуч, ліворуч. g - відступ від центру точки.
export const LABEL_CANDIDATES = 8;
function candidate(c, x, y, w, h, g, out) {
  switch (c) {
    case 0: out[0] = x + g; out[1] = y - h - 2; break;
    case 1: out[0] = x + g; out[1] = y + 2; break;
    case 2: out[0] = x - w - g; out[1] = y - h - 2; break;
    case 3: out[0] = x - w - g; out[1] = y + 2; break;
    case 4: out[0] = x - w / 2; out[1] = y - h - g; break;
    case 5: out[0] = x - w / 2; out[1] = y + g; break;
    case 6: out[0] = x + g + 2; out[1] = y - h / 2; break;
    default: out[0] = x - w - g - 2; out[1] = y - h / 2; break;
  }
  return out;
}

function overlapsBoxes(x, y, w, h, bx, by, bw, bh, n) {
  for (let k = 0; k < n; k++) {
    if (x < bx[k] + bw[k] && x + w > bx[k] && y < by[k] + bh[k] && y + h > by[k]) return true;
  }
  return false;
}

function overlapsDots(x, y, w, h, dots, self) {
  for (let k = 0; k < dots.count; k++) {
    if (k === self || !dots.visible[k]) continue;
    const cx = dots.x[k], cy = dots.y[k], r = dots.r[k];
    const nx = cx < x ? x : cx > x + w ? x + w : cx;
    const ny = cy < y ? y : cy > y + h ? y + h : cy;
    const dx = cx - nx, dy = cy - ny;
    if (dx * dx + dy * dy < r * r) return true;
  }
  return false;
}

/**
 * Жадібне розміщення підписів без перетинів (W4).
 * labels: {count, idx[k] (індекс машини), x[k], y[k] (центр точки), w[k], h[k],
 *          gap[k] (відступ від центру), prev[k] (кандидат минулого кадру, −1 - немає)}
 *          - уже впорядковані за спаданням пріоритету;
 * dots:   {count, x, y, r, visible} - точки машин (перешкоди, крім своєї);
 * bounds: {width, height, margin};
 * out:    {x[k], y[k], cand[k] (−1 - не вмістився)}; boxes - робочі буфери
 *          {x, y, w, h} довжиною ≥ labels.count.
 * Прохід 1 уникає підписів і точок, прохід 2 - лише підписів. Кандидат
 * минулого кадру пробуємо першим (підписи не «стрибають»).
 * Повертає кількість розміщених.
 */
const tmp2 = [0, 0];
export function placeLabels(labels, dots, bounds, out, boxes) {
  const { width, height } = bounds;
  const m = bounds.margin ?? 2;
  let placed = 0;
  for (let k = 0; k < labels.count; k++) {
    out.cand[k] = -1;
    const w = labels.w[k], h = labels.h[k], g = labels.gap[k];
    const self = labels.idx[k];
    let found = -1;
    for (let pass = 0; pass < 2 && found < 0; pass++) {
      for (let t = -1; t < LABEL_CANDIDATES; t++) {
        const c = t < 0 ? labels.prev[k] : t;
        if (c < 0 || (t >= 0 && c === labels.prev[k])) continue;
        candidate(c, labels.x[k], labels.y[k], w, h, g, tmp2);
        const x = tmp2[0], y = tmp2[1];
        if (x < m || y < m || x + w > width - m || y + h > height - m) continue;
        if (overlapsBoxes(x, y, w, h, boxes.x, boxes.y, boxes.w, boxes.h, placed)) continue;
        if (pass === 0 && overlapsDots(x, y, w, h, dots, self)) continue;
        found = c;
        out.x[k] = x;
        out.y[k] = y;
        break;
      }
    }
    if (found < 0) continue;
    out.cand[k] = found;
    boxes.x[placed] = out.x[k];
    boxes.y[placed] = out.y[k];
    boxes.w[placed] = w;
    boxes.h[placed] = h;
    placed++;
  }
  return placed;
}

/** Найближча видима машина в радіусі maxDist від (px, py): індекс або −1. */
export function nearestIndex(count, xs, ys, visible, px, py, maxDist = HIT_RADIUS) {
  let best = -1;
  let bd = maxDist * maxDist;
  for (let i = 0; i < count; i++) {
    if (!visible[i]) continue;
    const dx = xs[i] - px;
    const dy = ys[i] - py;
    const d = dx * dx + dy * dy;
    if (d <= bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

/**
 * Порядок малювання: від останнього місця до лідера, суперник і фокус -
 * останніми (зверху). key[i] більший → малюється пізніше. Сортування
 * вставками на місці (22 елементи), без алокацій.
 */
export function sortByKey(order, key, count) {
  for (let i = 0; i < count; i++) order[i] = i;
  for (let i = 1; i < count; i++) {
    const v = order[i];
    const kv = key[v];
    let j = i - 1;
    while (j >= 0 && key[order[j]] > kv) {
      order[j + 1] = order[j];
      j--;
    }
    order[j + 1] = v;
  }
  return order;
}

/**
 * Контур, що формується з location одного пілота, коли бекенд не дав
 * track (W4, стан «контур формується…»). Точки проріджуються (minStep), а
 * коли пройдено ≥ minLength і машина повернулась до першої точки ближче за
 * closeDist - контур замкнено. Стрибок > maxJump (пропуск даних,
 * перемотування) починає збір заново.
 */
export class ProgressiveOutline {
  constructor({ minStep = 50, closeDist = 250, minLength = 15000, maxJump = 1500 } = {}) {
    this.opts = { minStep, closeDist, minLength, maxJump };
    this.reset();
  }

  reset() {
    this.points = [];
    this.length = 0;
    this.closed = false;
    this.version = 0;
  }

  /** Додає точку. Повертає true, якщо контур змінився. */
  add(x, y) {
    if (this.closed) return false;
    const pts = this.points;
    const { minStep, closeDist, minLength, maxJump } = this.opts;
    if (!pts.length) {
      pts.push([x, y]);
      this.version++;
      return true;
    }
    const last = pts[pts.length - 1];
    const d = Math.hypot(x - last[0], y - last[1]);
    if (d > maxJump) {
      this.reset();
      this.points.push([x, y]);
      this.version++;
      return true;
    }
    if (d < minStep) return false;
    if (this.length + d >= minLength && Math.hypot(x - pts[0][0], y - pts[0][1]) < closeDist) {
      this.closed = true;
      this.version++;
      return true;
    }
    pts.push([x, y]);
    this.length += d;
    this.version++;
    return true;
  }
}
