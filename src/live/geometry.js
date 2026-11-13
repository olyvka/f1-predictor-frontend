// Геометрія контуру траси (W4, W6, L6, L7).
// `track.points` і `location.x/y` - одна система координат OpenF1 (одиниці ≈ 0.1 м),
// контур - замкнена ламана з найшвидшого кола, points[0] ≈ лінія старту/фінішу.

/**
 * Поріг піт-лейну: відстань від location до найближчого відрізка контуру.
 * На трасі машина тримається ≤ ~130 одиниць, у піт-лейні 220-360
 * (перевірено на Бразилії 2026). Подія `pit` для цього не годиться: її
 * date ≈ виїзд із боксів.
 */
export const PIT_LANE_DISTANCE = 150;

/**
 * Попередньо обчислені відрізки замкненого контуру. null, якщо точок < 2.
 * Повертає {points, n, ax, ay, dx, dy, len, s0 (Float64Array), length, bbox}.
 */
export function buildTrackGeometry(points) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const n = points.length;
  const ax = new Float64Array(n);
  const ay = new Float64Array(n);
  const dx = new Float64Array(n);
  const dy = new Float64Array(n);
  const len = new Float64Array(n);
  const s0 = new Float64Array(n);
  let total = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    ax[i] = a[0];
    ay[i] = a[1];
    dx[i] = b[0] - a[0];
    dy[i] = b[1] - a[1];
    len[i] = Math.hypot(dx[i], dy[i]);
    s0[i] = total;
    total += len[i];
    if (a[0] < minX) minX = a[0];
    if (a[0] > maxX) maxX = a[0];
    if (a[1] < minY) minY = a[1];
    if (a[1] > maxY) maxY = a[1];
  }
  return { points, n, ax, ay, dx, dy, len, s0, length: total, bbox: { minX, minY, maxX, maxY } };
}

function projectRange(g, x, y, from, count, out) {
  let best = Infinity;
  for (let k = 0; k < count; k++) {
    const i = (((from + k) % g.n) + g.n) % g.n;
    const L = g.len[i];
    let u = L ? ((x - g.ax[i]) * g.dx[i] + (y - g.ay[i]) * g.dy[i]) / (L * L) : 0;
    if (u < 0) u = 0;
    else if (u > 1) u = 1;
    const px = g.ax[i] + g.dx[i] * u;
    const py = g.ay[i] + g.dy[i] * u;
    const d = Math.hypot(x - px, y - py);
    if (d < best) {
      best = d;
      out.distance = d;
      out.s = g.s0[i] + L * u;
      out.index = i;
      out.x = px;
      out.y = py;
    }
  }
  return out;
}

/**
 * Проєкція точки на контур: {distance, s (довжина дуги від points[0]),
 * fraction (0..1, частка кола), index (відрізок), x, y (точка на контурі)}.
 * hint - індекс відрізка з попереднього кадру: тоді шукаємо у вікні ±window
 * (O(1)); якщо результат далі за поріг піт-лейну - повний перебір.
 * out - необов'язковий об'єкт для повторного використання (без алокацій у кадрі).
 */
export function projectOnTrack(g, x, y, { hint = -1, window = 10, out = {} } = {}) {
  out.distance = Infinity;
  out.s = 0;
  out.index = -1;
  out.x = x;
  out.y = y;
  if (!g) {
    out.fraction = null;
    return out;
  }
  if (hint >= 0 && g.n > 2 * window + 1) {
    projectRange(g, x, y, hint - window, 2 * window + 1, out);
    if (out.distance > PIT_LANE_DISTANCE) projectRange(g, x, y, 0, g.n, out);
  } else {
    projectRange(g, x, y, 0, g.n, out);
  }
  out.fraction = g.length ? out.s / g.length : null;
  return out;
}

/** Чи точка в піт-лейні (далі за поріг від контуру). Без контуру - false. */
export function isInPitLane(g, x, y) {
  if (!g) return false;
  return projectOnTrack(g, x, y).distance > PIT_LANE_DISTANCE;
}

/**
 * Автоповорот карти: канонічного кута в даних немає, тож перебираємо 0-175°
 * з кроком stepDeg і беремо кут з найбільшим масштабом (траса займає
 * найбільше місця). Новий кут приймаємо, лише якщо він дає > minGain виграшу,
 * щоб не «смикати» поворот через копійки.
 * points - [[x, y], ...] (контур + за бажанням побачені точки піт-лейну).
 * Повертає {angle (рад), cos, sin, scale, cx, cy, width, height, padding} або null.
 */
export function fitRotation(points, width, height, { padding = 24, stepDeg = 5, minGain = 1.02 } = {}) {
  if (!points || !points.length || !(width > 2 * padding) || !(height > 2 * padding)) return null;
  let best = null;
  for (let deg = 0; deg < 180; deg += stepDeg) {
    const a = (deg * Math.PI) / 180;
    const cs = Math.cos(a);
    const sn = Math.sin(a);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      const u = p[0] * cs - p[1] * sn;
      const v = p[0] * sn + p[1] * cs;
      if (u < x0) x0 = u;
      if (u > x1) x1 = u;
      if (v < y0) y0 = v;
      if (v > y1) y1 = v;
    }
    const w = Math.max(x1 - x0, 1e-9);
    const h = Math.max(y1 - y0, 1e-9);
    const scale = Math.min((width - 2 * padding) / w, (height - 2 * padding) / h);
    if (!best || scale > best.scale * minGain) {
      best = { angle: a, cos: cs, sin: sn, scale, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
    }
  }
  return { ...best, width, height, padding };
}

/**
 * Координати OpenF1 → CSS-пікселі контейнера за результатом fitRotation.
 * Вісь Y інвертована (у даних вгору, на екрані вниз). devicePixelRatio
 * застосовує сам віджет (ctx.setTransform(dpr, …)).
 */
export function toScreen(fit, x, y, out = [0, 0]) {
  const u = x * fit.cos - y * fit.sin;
  const v = x * fit.sin + y * fit.cos;
  out[0] = fit.width / 2 + (u - fit.cx) * fit.scale;
  out[1] = fit.height / 2 - (v - fit.cy) * fit.scale;
  return out;
}

/**
 * Частка кола з поправкою на перехід через лінію (портовано з прототипу):
 * для семплу на початку кола (< 8 с від старту) f > 0.8 означає «ще до
 * лінії» → f − 1; для попереднього кола в кінці (< 8 с до фінішу) f < 0.2
 * → f + 1. Значення поза [0, 1] відкидаємо (null).
 */
export function unwrapLapFraction(f, secondsFromLapStart, secondsToLapEnd) {
  if (f == null || f < 0) return null;
  let v = f;
  if (secondsFromLapStart != null && secondsFromLapStart < 8 && v > 0.8) v -= 1;
  if (secondsToLapEnd != null && secondsToLapEnd < 8 && v < 0.2) v += 1;
  return v < 0 || v > 1 ? null : v;
}
