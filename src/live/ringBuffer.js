// Кільцевий буфер семплів location (t, x, y) на typed arrays: без алокацій
// на кожну подію, фіксована пам'ять. Карта читає його в requestAnimationFrame.

export class TimeRing {
  constructor(capacity = 96) {
    this.capacity = capacity;
    this.t = new Float64Array(capacity);
    this.x = new Float64Array(capacity);
    this.y = new Float64Array(capacity);
    this.start = 0; // індекс найстарішого
    this.size = 0;
  }

  clear() {
    this.start = 0;
    this.size = 0;
  }

  /** Додає семпл. Семпл старіший за останній (поза порядком) відкидається. */
  push(t, x, y) {
    if (this.size && t < this.lastT()) return false;
    const i = (this.start + this.size) % this.capacity;
    this.t[i] = t;
    this.x[i] = x;
    this.y[i] = y;
    if (this.size < this.capacity) this.size++;
    else this.start = (this.start + 1) % this.capacity;
    return true;
  }

  /** Фізичний індекс k-го семплу (0 - найстаріший). */
  idx(k) {
    return (this.start + k) % this.capacity;
  }

  lastT() {
    return this.size ? this.t[this.idx(this.size - 1)] : null;
  }

  firstT() {
    return this.size ? this.t[this.start] : null;
  }

  /** Логічний індекс останнього семплу з t ≤ time, або −1. */
  floor(time) {
    let lo = 0, hi = this.size - 1, ans = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (this.t[this.idx(m)] <= time) {
        ans = m;
        lo = m + 1;
      } else hi = m - 1;
    }
    return ans;
  }

  /**
   * Положення на момент time з лінійною інтерполяцією між сусідами.
   * Пише в out {x, y, age (с від найближчого попереднього семплу), gap
   * (true - сусідні семпли далі ніж maxGapMs, інтерполяції немає), ok}.
   * До першого семплу - ok=false.
   */
  sample(time, out = {}, maxGapMs = 2000) {
    const k = this.floor(time);
    if (k < 0) {
      out.ok = false;
      return out;
    }
    const i0 = this.idx(k);
    out.ok = true;
    out.age = (time - this.t[i0]) / 1000;
    if (k === this.size - 1) {
      out.x = this.x[i0];
      out.y = this.y[i0];
      out.gap = false;
      return out;
    }
    const i1 = this.idx(k + 1);
    const dt = this.t[i1] - this.t[i0];
    if (dt > maxGapMs || dt <= 0) {
      out.x = this.x[i0];
      out.y = this.y[i0];
      out.gap = dt > maxGapMs;
      return out;
    }
    const f = (time - this.t[i0]) / dt;
    out.x = this.x[i0] + (this.x[i1] - this.x[i0]) * f;
    out.y = this.y[i0] + (this.y[i1] - this.y[i0]) * f;
    out.gap = false;
    out.age = 0;
    return out;
  }

  /** Обхід семплів з t ≥ fromT (для «хвоста» на карті). cb(t, x, y). */
  forEachSince(fromT, cb) {
    const k0 = Math.max(0, this.floor(fromT));
    for (let k = k0; k < this.size; k++) {
      const i = this.idx(k);
      if (this.t[i] >= fromT) cb(this.t[i], this.x[i], this.y[i]);
    }
  }
}
