// Імперативний рендерер карти траси (L6, LIVE_UI_RESEARCH W4). Живе поза
// React: React-обгортка (TrackMap.jsx) лише передає йому вхідні дані через
// set*-методи, а положення машин він сам читає зі стору в requestAnimationFrame.
//
// Два шари Canvas:
//   static  - контур (10 px + внутрішня лінія), тонування прапором на всю
//             трасу, риска старту/фінішу і стрілка напрямку; перемальовується
//             лише при resize / повороті / зміні контуру чи прапора;
//   dynamic - точки й підписи, кожен кадр, поки йде відтворення.
// Цикл rAF працює лише під час відтворення у видимій вкладці і з ненульовим
// розміром контейнера; на паузі/буферизації кадр малюється тільки на зміни
// (сповіщення стору, фокус, hover, resize).
//
// Без алокацій у кадрі: усі буфери - typed arrays фіксованого розміру,
// store.getCarsAt() повертає перевикористовувані об'єкти, ширини підписів
// кешуються, рядки підписів збираються заздалегідь.

import { toScreen } from "../../../live/geometry";
import {
  MAP_PADDING,
  HIT_RADIUS,
  chooseFit,
  fitAtAngle,
  exceedsFit,
  startFinishFrame,
  findClusters,
  placeLabels,
  nearestIndex,
  sortByKey,
  ProgressiveOutline,
} from "./mapMath";

const MAX = 64; // запас над 22 машинами
const NO_RANK = 999;
const TOP_N = 5;
const LABEL_H = 16;
const LABEL_FONT = "700 11px Inter, system-ui, sans-serif";
const STATS = 600; // кадрів у кільці статистики
const SEEN_CHECK_MS = 3000; // як часто перевіряти, чи вміщується піт-лейн
const OUTLINE_STATIC_MS = 500; // як часто перемальовувати контур, що формується

const ALPHA_PIT = 0.4; // W4: у піт-лейні
const ALPHA_STALE = 0.3; // W4: немає location > 10 с
const ALPHA_GAP = 0.6; // W4: пропуск у даних (без інтерполяції)
const ALPHA_UNFOCUSED = 0.72; // решта, коли є фокус

const FLAG_VARS = { SC: "--color-flag-sc", VSC: "--color-flag-sc", RED: "--color-flag-red" };

function readColors(el) {
  const css = getComputedStyle(el || document.documentElement);
  const g = (v, fb) => css.getPropertyValue(v).trim() || fb;
  return {
    surface: g("--color-surface", "#111318"),
    text: g("--color-text", "#f2f3f5"),
    dim: g("--color-text-dim", "#8b909a"),
    track: g("--color-track", "#3a4252"),
    edge: g("--color-track-edge", "#566074"),
    flags: {
      SC: g(FLAG_VARS.SC, "#f59e0b"),
      VSC: g(FLAG_VARS.VSC, "#f59e0b"),
      RED: g(FLAG_VARS.RED, "#dc2626"),
    },
  };
}

export class MapRenderer {
  /**
   * opts: {store, staticCanvas, canvas, colorsFrom (елемент для CSS-змінних),
   *        onTooltip(n | null, x, y) - позиція підказки (кожен кадр, поки є hover)}
   */
  constructor({ store, staticCanvas, canvas, colorsFrom, onTooltip, onShape }) {
    this.store = store;
    this.sc = staticCanvas;
    this.cv = canvas;
    this.sctx = staticCanvas.getContext("2d");
    this.ctx = canvas.getContext("2d");
    this.colors = readColors(colorsFrom);
    this.onTooltip = onTooltip || null;
    this.onShape = onShape || null; // ({hasShape, forming}) - для skeleton і «контур формується…»
    this.shapeKey = "";

    this.W = 0;
    this.H = 0;
    this.dpr = 1;
    this.fit = null;
    this.quarterTurns = 0;
    this.labelMode = "top";
    this.focus = null;
    this.rival = null;
    this.flag = null;
    this.track = null;
    this.outline = new ProgressiveOutline();
    this.outlineDriver = null;
    this.outlineFedT = -Infinity;
    this.outlineDrawnVersion = -1;
    this.outlineStaticAt = 0;
    this.seenCheckAt = 0;
    this.seenCount = 0;
    this.hover = null;
    this.tooltipShown = false;
    this.epoch = null;
    this.tableVersion = -1;

    this.drivers = new Map(); // n → {acronym, color, second}
    this.labelW = new Map(); // n → ширина підпису (px)
    this.suffix = []; // [k] → " +k"
    this.suffixW = [];
    this.ranks = new Int16Array(100).fill(NO_RANK);
    this.leader = null;

    // Буфери кадру (індекс = позиція в масиві getCarsAt).
    this.count = 0;
    this.num = new Int32Array(MAX);
    this.sx = new Float64Array(MAX);
    this.sy = new Float64Array(MAX);
    this.vis = new Uint8Array(MAX);
    this.alpha = new Float64Array(MAX);
    this.key = new Float64Array(MAX);
    this.order = new Int32Array(MAX);
    this.prio = new Int32Array(MAX);
    this.head = new Int32Array(MAX);
    this.csize = new Int32Array(MAX);
    this.dotR = new Float64Array(MAX);
    this.pt = [0, 0];
    this.dots = { count: 0, x: this.sx, y: this.sy, r: this.dotR, visible: this.vis };
    this.labels = {
      count: 0,
      idx: new Int32Array(MAX),
      x: new Float64Array(MAX),
      y: new Float64Array(MAX),
      w: new Float64Array(MAX),
      h: new Float64Array(MAX),
      gap: new Float64Array(MAX),
      prev: new Int8Array(MAX),
    };
    this.placed = { x: new Float64Array(MAX), y: new Float64Array(MAX), cand: new Int8Array(MAX) };
    this.boxes = { x: new Float64Array(MAX), y: new Float64Array(MAX), w: new Float64Array(MAX), h: new Float64Array(MAX) };
    this.lastCand = new Int8Array(100).fill(-1);

    // Статистика кадрів: тривалість draw() і інтервал між кадрами rAF.
    this.stats = { draw: new Float32Array(STATS), interval: new Float32Array(STATS), n: 0, i: 0, lastFrameAt: 0 };

    this.raf = 0;
    this.running = false;
    this.pending = false;
    this.destroyed = false;
    this.frame = this.frame.bind(this);
    this.drawOnce = this.drawOnce.bind(this);
    this.feedOutline = this.feedOutline.bind(this);
    this.onStore = this.onStore.bind(this);
    this.onVisibility = this.onVisibility.bind(this);
    this.unsub = store.subscribe(["playback", "table"], this.onStore);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.updateRanks();
    this.onStore();
  }

  destroy() {
    this.destroyed = true;
    this.unsub?.();
    document.removeEventListener("visibilitychange", this.onVisibility);
    cancelAnimationFrame(this.raf);
    this.running = false;
  }

  // --- вхідні дані ---

  setDrivers(drivers) {
    this.drivers.clear();
    for (const d of Object.values(drivers || {})) {
      this.drivers.set(d.number, { acronym: d.acronym, color: d.color, second: !!d.isSecondTeammate });
    }
    this.measure();
    this.requestDraw();
  }

  /** Ширини підписів (раз на склад пілотів і після завантаження шрифтів). */
  measure() {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = LABEL_FONT;
    this.labelW.clear();
    for (const [n, d] of this.drivers) this.labelW.set(n, Math.ceil(ctx.measureText(d.acronym).width) + 10);
    this.suffix = [];
    this.suffixW = [];
    for (let k = 0; k <= MAX; k++) {
      const s = ` +${k}`;
      this.suffix.push(s);
      this.suffixW.push(Math.ceil(ctx.measureText(s).width));
    }
    ctx.restore();
  }

  setTrack(track, sessionKey) {
    if (sessionKey !== this.sessionKey) {
      this.sessionKey = sessionKey;
      this.outline.reset();
      this.outlineDriver = null;
      this.outlineFedT = -Infinity;
      this.outlineDrawnVersion = -1;
      this.lastCand.fill(-1);
    }
    if (track === this.track && this.fit) return;
    this.track = track;
    this.refit(true);
  }

  setLabelMode(mode) {
    if (mode === this.labelMode) return;
    this.labelMode = mode;
    this.requestDraw();
  }

  setFocus(focus, rival) {
    this.focus = focus ?? null;
    this.rival = rival ?? null;
    this.requestDraw();
  }

  setQuarterTurns(k) {
    if (k === this.quarterTurns) return;
    this.quarterTurns = k;
    this.lastCand.fill(-1);
    this.refit(false);
  }

  /** Прапор на всю трасу: "SC" | "VSC" | "RED" | null - тонує контур. */
  setFlag(flag) {
    const f = FLAG_VARS[flag] ? flag : null;
    if (f === this.flag) return;
    this.flag = f;
    this.drawStatic();
  }

  setHover(n) {
    if (n === this.hover) return;
    this.hover = n;
    this.requestDraw();
  }

  setSize(W, H, dpr) {
    if (W === this.W && H === this.H && dpr === this.dpr) return;
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    for (const c of [this.sc, this.cv]) {
      c.width = Math.max(1, Math.round(W * dpr));
      c.height = Math.max(1, Math.round(H * dpr));
    }
    this.refit(true);
    this.updateLoop();
  }

  // --- геометрія ---

  /** Точки, що мають уміститися: контур (або той, що формується) + побачені location. */
  pointSets(seen) {
    const base = this.track ? this.track.points : this.outline.points;
    return seen && seen.length ? [base, seen] : [base];
  }

  /** autoAngle: true - перевибрати автоповорот (resize, нова траса); false - лише ручний поворот. */
  refit(autoAngle) {
    if (!(this.W > 0 && this.H > 0)) return;
    const seen = this.store.getSeenPoints();
    this.seenCount = seen.length;
    const sets = this.pointSets(seen);
    if (!sets.some((s) => s.length)) {
      this.fit = null;
    } else {
      this.fit = chooseFit(sets, this.W, this.H, {
        padding: MAP_PADDING,
        quarterTurns: this.quarterTurns,
        prevAutoAngle: this.fit?.autoAngle ?? null,
        // resize/нова траса: кут можна перевибрати (якщо новий кращий > 4 %);
        // ручний поворот: автокут не чіпаємо.
        stickiness: autoAngle ? 1.04 : Infinity,
      });
    }
    this.drawStatic();
  }

  /**
   * Раз на кілька секунд: якщо з'явилися побачені точки поза картою (піт-лейн),
   * зменшуємо масштаб під тим самим кутом - карта не повертається сама.
   */
  checkSeen(now) {
    if (now - this.seenCheckAt < SEEN_CHECK_MS || !this.fit) return;
    this.seenCheckAt = now;
    const seen = this.store.getSeenPoints();
    if (seen.length === this.seenCount) return;
    this.seenCount = seen.length;
    if (!exceedsFit(this.fit, seen)) return;
    const auto = this.fit.autoAngle;
    const next = fitAtAngle(this.pointSets(seen), this.fit.angle, this.W, this.H, { padding: MAP_PADDING });
    if (!next) return;
    next.autoAngle = auto;
    this.fit = next;
    this.drawStatic();
  }

  // --- контур без track (формується з location) ---

  feedPoint(t, x, y) {
    if (t <= this.outlineFedT) return;
    this.outlineFedT = t;
    this.outline.add(x, y);
  }

  /** Підживлює контур слідом одного пілота (лідер або перший з даними). */
  feedOutline() {
    if (this.track || this.outline.closed) return;
    const store = this.store;
    let n = this.outlineDriver;
    let ring = n != null ? store.getTrail(n) : null;
    const lastT = ring?.lastT();
    // Пілот зник/заїхав у гараж: беремо іншого і починаємо заново.
    if (n == null || !ring || !ring.size || (this.outlineFedT > -Infinity && lastT != null && lastT - this.outlineFedT > 5000)) {
      n = null;
      const prefer = this.leader;
      if (prefer != null && store.getTrail(prefer)?.size) n = prefer;
      else for (const k of this.drivers.keys()) if (store.getTrail(k)?.size) { n = k; break; }
      if (n == null) return;
      if (n !== this.outlineDriver) {
        this.outlineDriver = n;
        this.outlineFedT = -Infinity;
        this.outline.reset();
      }
      ring = store.getTrail(n);
    }
    const before = this.outline.version;
    const from = this.outlineFedT === -Infinity ? -Infinity : this.outlineFedT;
    ring.forEachSince(from, (t, x, y) => this.feedPoint(t, x, y));
    if (this.outline.version !== before) {
      const now = performance.now();
      const wasNull = !this.fit;
      if (this.outline.closed || wasNull || now - this.outlineStaticAt > OUTLINE_STATIC_MS) {
        this.outlineStaticAt = now;
        // Поки контур росте, вписування перераховуємо (кут може змінитися).
        this.refit(true);
      }
    }
  }

  // --- стан відтворення / таблиця ---

  updateRanks() {
    const tower = this.store.getTower();
    this.ranks.fill(NO_RANK);
    let i = 0;
    for (const r of tower.rows) {
      if (r.driverNumber >= 0 && r.driverNumber < 100) this.ranks[r.driverNumber] = r.position ?? 500 + i;
      i++;
    }
    this.leader = tower.leaderNumber ?? null;
  }

  onStore() {
    if (this.destroyed) return;
    const tv = this.store.getVersion("table") + this.store.getVersion("meta") * 1e6;
    if (tv !== this.tableVersion) {
      this.tableVersion = tv;
      this.updateRanks();
    }
    const epoch = this.store.getState().playback.epoch;
    if (epoch !== this.epoch) {
      this.epoch = epoch;
      // Перемотування/перепідключення: сліди в сторі скинуто. Замкнений контур
      // лишається (геометрія не залежить від часу), незамкнений збираємо заново.
      if (!this.outline.closed) {
        this.outline.reset();
        this.outlineDriver = null;
      }
      this.outlineFedT = -Infinity;
    }
    if (!this.track) this.feedOutline();
    this.checkSeen(performance.now());
    this.updateLoop();
    this.requestDraw();
  }

  onVisibility() {
    this.updateLoop();
    if (!document.hidden) this.requestDraw();
  }

  isPlaying() {
    const p = this.store.getState().playback;
    return p.status === "playing" && !p.paused && !p.ended && !p.seeking;
  }

  /** Безперервний rAF лише під час відтворення, у видимій вкладці, з ненульовим розміром. */
  updateLoop() {
    const want = !this.destroyed && this.W > 0 && this.H > 0 && !document.hidden && this.isPlaying();
    if (want && !this.running) {
      this.running = true;
      this.stats.lastFrameAt = 0;
      cancelAnimationFrame(this.raf);
      this.pending = false;
      this.raf = requestAnimationFrame(this.frame);
    } else if (!want && this.running) {
      this.running = false;
      cancelAnimationFrame(this.raf);
      this.requestDraw(); // останній кадр на момент паузи
    }
  }

  /** Один кадр на зміну (коли цикл стоїть). */
  requestDraw() {
    if (this.running || this.pending || this.destroyed) return;
    this.pending = true;
    this.raf = requestAnimationFrame(this.drawOnce);
  }

  drawOnce() {
    this.pending = false;
    if (this.W > 0 && !document.hidden) this.draw();
  }

  frame(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.frame);
    const s = this.stats;
    const t0 = performance.now();
    this.draw();
    const dt = performance.now() - t0;
    s.draw[s.i] = dt;
    s.interval[s.i] = s.lastFrameAt ? now - s.lastFrameAt : 0;
    s.lastFrameAt = now;
    s.i = (s.i + 1) % STATS;
    if (s.n < STATS) s.n++;
  }

  /** Статистика (для вимірювань, не в кадрі): {frames, drawAvg, drawP95, drawMax, fps, intervalP95}. */
  getStats() {
    const s = this.stats;
    const n = s.n;
    if (!n) return null;
    const d = Array.from(s.draw.slice(0, n)).sort((a, b) => a - b);
    const iv = Array.from(s.interval.slice(0, n)).filter((v) => v > 0).sort((a, b) => a - b);
    const avg = (a) => a.reduce((x, y) => x + y, 0) / (a.length || 1);
    const pct = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))] ?? null;
    return {
      frames: n,
      drawAvg: +avg(d).toFixed(3),
      drawP95: +pct(d, 0.95).toFixed(3),
      drawMax: +d[d.length - 1].toFixed(3),
      fps: iv.length ? +(1000 / avg(iv)).toFixed(1) : null,
      intervalP95: iv.length ? +pct(iv, 0.95).toFixed(2) : null,
      over20ms: iv.filter((v) => v > 20).length,
    };
  }

  resetStats() {
    this.stats.n = 0;
    this.stats.i = 0;
    this.stats.lastFrameAt = 0;
  }

  // --- статичний шар ---

  tracePath(ctx, pts, close) {
    const fit = this.fit;
    const p = this.pt;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      toScreen(fit, pts[i][0], pts[i][1], p);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    }
    if (close) ctx.closePath();
  }

  emitShape() {
    const hasShape = !!this.fit;
    const forming = !this.track && !this.outline.closed;
    const key = `${hasShape}|${forming}`;
    if (key === this.shapeKey || !this.onShape) return;
    this.shapeKey = key;
    this.onShape({ hasShape, forming });
  }

  drawStatic() {
    this.emitShape();
    const ctx = this.sctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.sc.width, this.sc.height);
    this.requestDraw();
    if (!this.fit || !(this.W > 0)) return;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const C = this.colors;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const forming = !this.track && !this.outline.closed;
    const pts = this.track ? this.track.points : this.outline.points;

    if (forming) {
      // Хмара побачених точок дає обриси ще до замикання кола.
      const seen = this.store.getSeenPoints();
      ctx.fillStyle = C.edge;
      ctx.globalAlpha = 0.35;
      const p = this.pt;
      for (let i = 0; i < seen.length; i++) {
        toScreen(this.fit, seen[i][0], seen[i][1], p);
        ctx.fillRect(p[0] - 1, p[1] - 1, 2, 2);
      }
      ctx.globalAlpha = 1;
      if (pts.length > 1) {
        this.tracePath(ctx, pts, false);
        ctx.strokeStyle = C.track;
        ctx.lineWidth = 6;
        ctx.setLineDash([2, 10]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      return;
    }
    if (pts.length < 2) return;

    // Контур: 10 px + світліша внутрішня лінія 2 px (W4).
    this.tracePath(ctx, pts, true);
    ctx.strokeStyle = C.track;
    ctx.lineWidth = 10;
    ctx.stroke();
    if (this.flag) {
      // Прапор на всю трасу - тонування 35 %; VSC штрихом (як штриховка в банері).
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = C.flags[this.flag];
      if (this.flag === "VSC") ctx.setLineDash([10, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = C.edge;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (!this.track || pts.length < 4) return;
    // Старт/фініш: points[0] - лінія (контур узято з кола від лінії), напрям points[0] → points[3].
    const a = toScreen(this.fit, pts[0][0], pts[0][1], [0, 0]);
    const b = toScreen(this.fit, pts[3][0], pts[3][1], [0, 0]);
    const f = startFinishFrame(a[0], a[1], b[0], b[1]);
    if (!f) return;
    ctx.lineCap = "butt";
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.ax - f.nx * 9, f.ay - f.ny * 9);
    ctx.lineTo(f.ax + f.nx * 9, f.ay + f.ny * 9);
    ctx.stroke();
    // Стрілка напрямку поруч із лінією, з зовнішнього боку контуру.
    const cx = f.ax + f.ux * 22 + f.nx * 16;
    const cy = f.ay + f.uy * 22 + f.ny * 16;
    ctx.fillStyle = C.dim;
    ctx.beginPath();
    ctx.moveTo(cx + f.ux * 6, cy + f.uy * 6);
    ctx.lineTo(cx - f.ux * 4 + f.nx * 4.5, cy - f.uy * 4 + f.ny * 4.5);
    ctx.lineTo(cx - f.ux * 4 - f.nx * 4.5, cy - f.uy * 4 - f.ny * 4.5);
    ctx.closePath();
    ctx.fill();
  }

  // --- динамічний шар ---

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    this.count = 0;
    const fit = this.fit;
    if (!fit) return this.emitTooltip();
    const rt = this.store.getRenderTime();
    if (rt == null) return this.emitTooltip();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const cars = this.store.getCarsAt(rt);
    const count = Math.min(cars.length, MAX);
    const hasTrack = !!this.track;
    const focus = this.focus;
    const rival = this.rival;
    const hasFocus = focus != null;
    const p = this.pt;
    for (let i = 0; i < count; i++) {
      const c = cars[i];
      const n = c.driverNumber;
      this.num[i] = n;
      const on = c.ok && !c.gone && this.drivers.has(n);
      this.vis[i] = on ? 1 : 0;
      if (!on) {
        this.key[i] = -1;
        continue;
      }
      // На трасі - точка на контурі; у піт-лейні - сира (не прив'язуємо).
      const snap = hasTrack && !c.inPit;
      toScreen(fit, snap ? c.snapX : c.x, snap ? c.snapY : c.y, p);
      this.sx[i] = p[0];
      this.sy[i] = p[1];
      let a = 1;
      if (c.stale) a = ALPHA_STALE;
      else if (c.inPit) a = ALPHA_PIT;
      else if (c.gap) a = ALPHA_GAP;
      const isFocus = n === focus;
      const isRival = n === rival;
      if (hasFocus && !isFocus && !isRival) a *= ALPHA_UNFOCUSED;
      this.alpha[i] = a;
      this.dotR[i] = isFocus ? 8 : 6;
      const rank = n >= 0 && n < 100 ? this.ranks[n] : NO_RANK;
      // Більший ключ - малюється пізніше (вище): останнє місце → лідер → суперник → фокус.
      this.key[i] = isFocus ? 1e6 : isRival ? 1e5 : 1000 - rank;
    }
    this.count = count;
    this.dots.count = count;
    sortByKey(this.order, this.key, count);
    for (let k = 0; k < count; k++) this.prio[k] = this.order[count - 1 - k];

    const C = this.colors;
    const TAU = Math.PI * 2;
    ctx.lineWidth = 2;
    for (let k = 0; k < count; k++) {
      const i = this.order[k];
      if (!this.vis[i]) continue;
      const n = this.num[i];
      const d = this.drivers.get(n);
      const x = this.sx[i], y = this.sy[i], r = this.dotR[i];
      const isFocus = n === focus;
      ctx.globalAlpha = this.alpha[i];
      if (isFocus || n === rival || n === this.hover) {
        // Ореол: фокус - світлий, суперник/hover - тьмяніший.
        ctx.beginPath();
        ctx.arc(x, y, r + 4, 0, TAU);
        ctx.strokeStyle = isFocus ? C.text : C.dim;
        ctx.globalAlpha = this.alpha[i] * (isFocus ? 0.55 : 0.45);
        ctx.stroke();
        ctx.globalAlpha = this.alpha[i];
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = d.color;
      ctx.fill();
      ctx.strokeStyle = isFocus ? C.text : C.surface;
      ctx.stroke();
      if (d.second) {
        ctx.beginPath();
        ctx.arc(x, y, isFocus ? 2.5 : 2, 0, TAU);
        ctx.fillStyle = "#FFFFFF";
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.drawLabels(ctx);
    this.emitTooltip();
  }

  wantsLabel(n) {
    if (n === this.focus || n === this.rival) return true;
    const mode = this.labelMode;
    if (mode === "all") return true;
    if (mode === "top") return n >= 0 && n < 100 && this.ranks[n] <= TOP_N;
    // «Лише фокус»: без фокуса підписуємо лідера, щоб карта не була німою.
    return this.focus == null && n === this.leader;
  }

  drawLabels(ctx) {
    const count = this.count;
    findClusters(count, this.prio, this.sx, this.sy, this.vis, this.head, this.csize);
    const L = this.labels;
    let m = 0;
    for (let k = 0; k < count; k++) {
      const i = this.prio[k];
      if (!this.vis[i] || this.head[i] !== i) continue;
      // Кластер підписуємо, якщо підпис потрібен будь-кому з нього (голова - найвищий пріоритет).
      let want = this.wantsLabel(this.num[i]);
      if (!want && this.csize[i] > 1) {
        for (let j = 0; j < count && !want; j++) if (this.head[j] === i && j !== i && this.wantsLabel(this.num[j])) want = true;
      }
      if (!want) continue;
      const n = this.num[i];
      const extra = this.csize[i] > 1 ? this.csize[i] - 1 : 0;
      L.idx[m] = i;
      L.x[m] = this.sx[i];
      L.y[m] = this.sy[i];
      L.w[m] = (this.labelW.get(n) || 30) + (extra ? this.suffixW[Math.min(extra, MAX)] : 0);
      L.h[m] = LABEL_H;
      L.gap[m] = this.dotR[i] + 4;
      L.prev[m] = n >= 0 && n < 100 ? this.lastCand[n] : -1;
      m++;
    }
    L.count = m;
    placeLabels(L, this.dots, { width: this.W, height: this.H, margin: 2 }, this.placed, this.boxes);

    const C = this.colors;
    ctx.font = LABEL_FONT;
    ctx.textBaseline = "middle";
    for (let k = 0; k < m; k++) {
      const i = L.idx[k];
      const n = this.num[i];
      const cand = this.placed.cand[k];
      if (n >= 0 && n < 100) this.lastCand[n] = cand;
      if (cand < 0) continue;
      const d = this.drivers.get(n);
      const x = this.placed.x[k], y = this.placed.y[k], w = L.w[k], h = L.h[k];
      const isFocus = n === this.focus;
      ctx.globalAlpha = this.alpha[i] < 1 && !isFocus ? Math.max(0.55, this.alpha[i]) : 1;
      ctx.fillStyle = C.surface;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();
      if (isFocus) {
        ctx.strokeStyle = C.dim;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.fillStyle = d.color;
      ctx.fillRect(x, y + 3, 2, h - 6);
      ctx.fillStyle = isFocus || n === this.rival ? C.text : C.dim;
      ctx.fillText(d.acronym, x + 6, y + h / 2 + 0.5);
      const extra = this.csize[i] > 1 ? this.csize[i] - 1 : 0;
      if (extra) {
        ctx.fillStyle = C.dim;
        ctx.fillText(this.suffix[Math.min(extra, MAX)], x + (this.labelW.get(n) || 30) - 4, y + h / 2 + 0.5);
      }
    }
    ctx.globalAlpha = 1;
  }

  emitTooltip() {
    if (!this.onTooltip) return;
    if (this.hover != null) {
      for (let i = 0; i < this.count; i++) {
        if (this.num[i] === this.hover && this.vis[i]) {
          this.tooltipShown = true;
          return this.onTooltip(this.hover, this.sx[i], this.sy[i]);
        }
      }
    }
    if (this.tooltipShown) {
      this.tooltipShown = false;
      this.onTooltip(null, 0, 0);
    }
  }

  /** Номер пілота під точкою (CSS px контейнера) у радіусі HIT_RADIUS або null. */
  hitTest(px, py, radius = HIT_RADIUS) {
    const i = nearestIndex(this.count, this.sx, this.sy, this.vis, px, py, radius);
    return i < 0 ? null : this.num[i];
  }

  /** Стан для тестів/діагностики. */
  debugState() {
    return {
      W: this.W,
      H: this.H,
      dpr: this.dpr,
      running: this.running,
      angleDeg: this.fit ? Math.round((this.fit.angle * 180) / Math.PI) : null,
      autoAngleDeg: this.fit?.autoAngle != null ? Math.round((this.fit.autoAngle * 180) / Math.PI) : null,
      scale: this.fit?.scale ?? null,
      track: !!this.track,
      outline: { points: this.outline.points.length, closed: this.outline.closed, driver: this.outlineDriver },
      flag: this.flag,
      labelMode: this.labelMode,
      visible: Array.from(this.vis.slice(0, this.count)).reduce((a, b) => a + b, 0),
      labels: Array.from(this.placed.cand.slice(0, this.labels.count)).filter((c) => c >= 0).length,
      wanted: this.labels.count,
    };
  }
}
