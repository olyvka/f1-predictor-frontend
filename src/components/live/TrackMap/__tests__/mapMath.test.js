import { describe, it, expect } from "vitest";
import { toScreen } from "../../../../live/geometry";
import {
  extentsAtAngle,
  fitAtAngle,
  chooseFit,
  exceedsFit,
  normAngle,
  startFinishFrame,
  findClusters,
  placeLabels,
  nearestIndex,
  sortByKey,
  ProgressiveOutline,
  LABEL_CANDIDATES,
} from "../mapMath";
import race from "../../../../live/__fixtures__/brazil-2026-race.json";

const deg = (d) => (d * Math.PI) / 180;
// Витягнутий прямокутник 1000×100 - найкраще лягає горизонтально в широкий контейнер.
const BAR = [
  [0, 0],
  [1000, 0],
  [1000, 100],
  [0, 100],
];

function labelsFor(points, { w = 30, h = 16, gap = 10 } = {}) {
  const n = points.length;
  const L = {
    count: n,
    idx: new Int32Array(n),
    x: new Float64Array(n),
    y: new Float64Array(n),
    w: new Float64Array(n).fill(w),
    h: new Float64Array(n).fill(h),
    gap: new Float64Array(n).fill(gap),
    prev: new Int8Array(n).fill(-1),
  };
  points.forEach(([x, y], i) => {
    L.idx[i] = i;
    L.x[i] = x;
    L.y[i] = y;
  });
  return L;
}
const outFor = (n) => ({ x: new Float64Array(n), y: new Float64Array(n), cand: new Int8Array(n) });
const boxesFor = (n) => ({ x: new Float64Array(n), y: new Float64Array(n), w: new Float64Array(n), h: new Float64Array(n) });
const noDots = { count: 0, x: [], y: [], r: [], visible: [] };
const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

describe("вписування і поворот", () => {
  it("межі в повернутій системі", () => {
    const e = extentsAtAngle([BAR], 1, 0);
    expect(e).toEqual({ u0: 0, u1: 1000, v0: 0, v1: 100 });
    const r = extentsAtAngle([BAR], Math.cos(deg(90)), Math.sin(deg(90)));
    expect(r.u1 - r.u0).toBeCloseTo(100);
    expect(r.v1 - r.v0).toBeCloseTo(1000);
    expect(extentsAtAngle([[], null], 1, 0)).toBeNull();
  });

  it("fitAtAngle центрує і масштабує з відступами; toScreen кладе точки всередину", () => {
    const fit = fitAtAngle([BAR], 0, 548, 148, { padding: 24 });
    expect(fit.scale).toBeCloseTo(0.5);
    const p = [0, 0];
    for (const [x, y] of BAR) {
      toScreen(fit, x, y, p);
      expect(p[0]).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(p[0]).toBeLessThanOrEqual(548 - 24 + 1e-9);
      expect(p[1]).toBeGreaterThanOrEqual(24 - 1e-9);
      expect(p[1]).toBeLessThanOrEqual(148 - 24 + 1e-9);
    }
    expect(fitAtAngle([BAR], 0, 40, 40, { padding: 24 })).toBeNull();
  });

  it("автоповорот: широкий контейнер - прямокутник горизонтально, високий - вертикально", () => {
    const wide = chooseFit([BAR], 800, 300);
    expect(Math.round((wide.angle * 180) / Math.PI) % 180).toBe(0);
    const tall = chooseFit([BAR], 300, 800);
    expect(Math.round((tall.angle * 180) / Math.PI)).toBe(90);
  });

  it("ручний поворот додає 90° до автокута, автокут лишається", () => {
    const base = chooseFit([BAR], 800, 300);
    const turned = chooseFit([BAR], 800, 300, { quarterTurns: 1, prevAutoAngle: base.autoAngle, stickiness: Infinity });
    expect(turned.autoAngle).toBe(base.autoAngle);
    expect(normAngle(turned.angle - base.angle)).toBeCloseTo(Math.PI / 2);
    expect(turned.scale).toBeLessThan(base.scale);
  });

  it("липкість: попередній кут лишається, якщо новий кращий менше ніж на 4 %", () => {
    const fit = chooseFit([BAR], 800, 300, { prevAutoAngle: deg(2) });
    expect(fit.autoAngle).toBe(deg(2));
    const tall = chooseFit([BAR], 300, 800, { prevAutoAngle: 0 });
    expect(Math.round((tall.autoAngle * 180) / Math.PI)).toBe(90);
  });

  it("Інтерлагос: усі точки контуру вміщуються, поворот вибирає більший масштаб, ніж 0°", () => {
    const pts = race.messages.find((m) => m.msg.type === "session").msg.track.points;
    for (const [W, H] of [
      [700, 520],
      [360, 560],
    ]) {
      const fit = chooseFit([pts], W, H);
      const p = [0, 0];
      for (const [x, y] of pts) {
        toScreen(fit, x, y, p);
        expect(p[0]).toBeGreaterThan(23);
        expect(p[0]).toBeLessThan(W - 23);
        expect(p[1]).toBeGreaterThan(23);
        expect(p[1]).toBeLessThan(H - 23);
      }
      expect(fit.scale).toBeGreaterThanOrEqual(fitAtAngle([pts], 0, W, H).scale);
    }
  });

  it("exceedsFit помічає точки поза межами (піт-лейн)", () => {
    const fit = fitAtAngle([BAR], 0, 800, 300);
    expect(exceedsFit(fit, [[500, 50]])).toBe(false);
    expect(exceedsFit(fit, [[500, 180]])).toBe(true);
    expect(exceedsFit(fit, null)).toBe(false);
  });

  it("риска старту: одиничний напрям і нормаль", () => {
    const f = startFinishFrame(0, 0, 10, 0);
    expect(f.ux).toBe(1);
    expect(f.uy).toBe(0);
    expect(f.nx).toBeCloseTo(0);
    expect(f.ny).toBe(1);
    expect(startFinishFrame(5, 5, 5, 5)).toBeNull();
  });
});

describe("кластери", () => {
  const run = (pts, order = pts.map((_, i) => i), visible = pts.map(() => 1)) => {
    const n = pts.length;
    const head = new Int32Array(n);
    const size = new Int32Array(n);
    findClusters(n, Int32Array.from(order), Float64Array.from(pts.map((p) => p[0])), Float64Array.from(pts.map((p) => p[1])), Uint8Array.from(visible), head, size);
    return { head: Array.from(head), size: Array.from(size) };
  };

  it("три точки в радіусі 14 px - один кластер з головою найвищого пріоритету", () => {
    const { head, size } = run(
      [
        [100, 100],
        [108, 100],
        [100, 110],
        [300, 300],
      ],
      [2, 0, 1, 3]
    );
    expect(head).toEqual([2, 2, 2, 3]);
    expect(size[2]).toBe(3);
    expect(size[3]).toBe(1);
  });

  it("дві близькі точки - не кластер (кожна зі своїм підписом)", () => {
    const { head, size } = run([
      [100, 100],
      [105, 100],
    ]);
    expect(head).toEqual([0, 1]);
    expect(size).toEqual([1, 1]);
  });

  it("невидимі машини не входять у кластери", () => {
    const { head, size } = run(
      [
        [100, 100],
        [104, 100],
        [100, 104],
      ],
      [0, 1, 2],
      [1, 1, 0]
    );
    expect(head).toEqual([0, 1, -1]);
    expect(size[0]).toBe(1);
  });

  it("щільна купа з 6 машин: один підпис «+5»", () => {
    const pts = Array.from({ length: 6 }, (_, i) => [200 + i * 2, 200 + (i % 2) * 3]);
    const { head, size } = run(pts);
    expect(new Set(head)).toEqual(new Set([0]));
    expect(size[0]).toBe(6);
  });
});

describe("розміщення підписів", () => {
  it("підписи скупчених точок не перетинаються", () => {
    // 10 машин уздовж прямої з кроком 9 px (старт стінта, всі впритул).
    const pts = Array.from({ length: 10 }, (_, i) => [200 + i * 9, 200]);
    const L = labelsFor(pts);
    const out = outFor(10);
    const placed = placeLabels(L, noDots, { width: 600, height: 400 }, out, boxesFor(10));
    expect(placed).toBeGreaterThan(3);
    const boxes = [];
    for (let k = 0; k < 10; k++) if (out.cand[k] >= 0) boxes.push({ x: out.x[k], y: out.y[k], w: 30, h: 16 });
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) expect(intersects(boxes[a], boxes[b])).toBe(false);
  });

  it("вищий пріоритет розміщується першим; без місця підпис пропускається", () => {
    const L = labelsFor([
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
      [50, 50],
    ]);
    const out = outFor(10);
    const placed = placeLabels(L, noDots, { width: 400, height: 400 }, out, boxesFor(10));
    expect(out.cand[0]).toBe(0); // праворуч-вгору
    expect(placed).toBeLessThanOrEqual(LABEL_CANDIDATES);
    expect(placed).toBeLessThan(10);
  });

  it("не виходить за межі полотна: біля правого краю - ліворуч", () => {
    const L = labelsFor([[590, 200]]);
    const out = outFor(1);
    placeLabels(L, noDots, { width: 600, height: 400 }, out, boxesFor(1));
    expect(out.cand[0]).toBeGreaterThanOrEqual(0);
    expect(out.x[0] + 30).toBeLessThanOrEqual(598);
  });

  it("обходить чужі точки, якщо є місце", () => {
    const L = labelsFor([[100, 100]]);
    // Чужа точка там, де був би підпис праворуч-вгору.
    const dots = { count: 2, x: [100, 125], y: [100, 92], r: [6, 6], visible: [1, 1] };
    const out = outFor(1);
    placeLabels(L, dots, { width: 600, height: 400 }, out, boxesFor(1));
    expect(out.cand[0]).not.toBe(0);
    expect(out.cand[0]).toBeGreaterThanOrEqual(0);
  });

  it("кандидат минулого кадру має перевагу (підписи не стрибають)", () => {
    const L = labelsFor([[100, 100]]);
    L.prev[0] = 3;
    const out = outFor(1);
    placeLabels(L, noDots, { width: 600, height: 400 }, out, boxesFor(1));
    expect(out.cand[0]).toBe(3);
  });
});

describe("взаємодія і порядок", () => {
  it("найближча видима машина в радіусі 16 px", () => {
    const xs = [10, 40, 100];
    const ys = [10, 10, 100];
    expect(nearestIndex(3, xs, ys, [1, 1, 1], 30, 12)).toBe(1);
    expect(nearestIndex(3, xs, ys, [1, 0, 1], 30, 12)).toBe(-1); // до 0-ї ~20 px
    expect(nearestIndex(3, xs, ys, [1, 0, 1], 22, 12)).toBe(0);
    expect(nearestIndex(3, xs, ys, [1, 1, 1], 70, 60)).toBe(-1);
  });

  it("порядок малювання за ключем (останнє місце → лідер → фокус)", () => {
    const key = Float64Array.from([1000 - 1, 1e6, 1000 - 20, 1000 - 3]);
    const order = new Int32Array(4);
    sortByKey(order, key, 4);
    expect(Array.from(order)).toEqual([2, 3, 0, 1]);
  });
});

describe("контур, що формується (track == null)", () => {
  it("проріджує точки і замикається після кола", () => {
    const o = new ProgressiveOutline({ minStep: 50, closeDist: 250, minLength: 3000 });
    const R = 1000;
    for (let a = 0; a <= 2 * Math.PI + 0.3; a += 0.01) {
      o.add(R * Math.cos(a), R * Math.sin(a));
      if (o.closed) break;
    }
    expect(o.closed).toBe(true);
    expect(o.length).toBeGreaterThan(5000);
    // ~2πR / 50 точок, без зайвих
    expect(o.points.length).toBeGreaterThan(100);
    expect(o.points.length).toBeLessThan(140);
    expect(o.add(0, 0)).toBe(false);
  });

  it("стрибок (пропуск даних) починає збір заново", () => {
    const o = new ProgressiveOutline({ minStep: 10, maxJump: 500 });
    o.add(0, 0);
    o.add(20, 0);
    o.add(40, 0);
    expect(o.points.length).toBe(3);
    o.add(5000, 0);
    expect(o.points).toEqual([[5000, 0]]);
    expect(o.length).toBe(0);
  });
});
