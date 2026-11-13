// Офлайн-джерело (L3, L13): програє записану фікстуру без бекенду.
//
// Як влаштовано: FixtureSource - це той самий ReplaySource, але замість
// справжнього WebSocket йому дають FixtureSocket, що поводиться як бекенд
// (session → catch-up → batch ~4/с за годинником replay, команди pause /
// resume / speed → state, кінець → end). Тож статуси, connId, перемотування й
// перепідключення працюють і в офлайн-режимі однаково.
//
// Фікстура: {meta, messages: [{at, msg}]} (див. scripts/record-live-fixture.mjs).
// Перемотування можливе лише в межах записаного відрізку (clamp).
// Для перевірки обриву: опція dropAfterMs закриває сокет «аварійно» (code 1006)
// через стільки мс після відкриття - ReplaySource перейде в lost і перепідключиться.

import { ReplaySource } from "./ReplaySource";
import { parseTime, toIso } from "../time";
import { clampSpeed } from "../store";

const STREAM_TOPICS = new Set(["location", "car_data"]);
const STATE_TOPICS = new Set(["position", "intervals", "weather"]);

/** Розбирає фікстуру в зручну для програвання форму. */
export function prepareFixture(fixture) {
  const messages = (fixture?.messages || []).map((m) => m.msg ?? m);
  const sessionMsg = messages.find((m) => m.type === "session");
  if (!sessionMsg) throw new Error("Фікстура без повідомлення session");
  const catchup = messages.find((m) => m.type === "batch" && m.catchup);
  const timeline = [];
  let order = 0;
  let endClock = parseTime(catchup?.clock);
  for (const m of messages) {
    if (m.type !== "batch" || m.catchup) continue;
    const bc = parseTime(m.clock);
    if (bc != null && (endClock == null || bc > endClock)) endClock = bc;
    for (const e of m.events || []) {
      const t = e.data?.date != null ? parseTime(e.data.date) : bc;
      timeline.push({ t: t ?? bc, i: order++, e });
    }
  }
  timeline.sort((a, b) => a.t - b.t || a.i - b.i);
  const startClock = parseTime(catchup?.clock ?? sessionMsg.replay?.start);
  return {
    sessionMsg,
    catchupEvents: catchup?.events || [],
    timeline,
    startClock,
    endClock: endClock ?? startClock,
    sessionStart: parseTime(sessionMsg.session?.date_start),
  };
}

/**
 * Фабрика класу «WebSocket», що програє фікстуру. fixture - об'єкт або Promise.
 * opts: {loadDelayMs (імітація 3-8 с бекенду, за замовчуванням 400), tickMs (250),
 *        dropAfterMs (імітація обриву), now}
 */
export function makeFixtureSocket(fixture, { loadDelayMs = 400, tickMs = 250, dropAfterMs = null, now = () => Date.now() } = {}) {
  let prepared = null;
  const ready = Promise.resolve(fixture).then((f) => (prepared = prepareFixture(f)));
  let drops = 0;

  return class FixtureSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.onopen = this.onmessage = this.onclose = this.onerror = null;
      const q = new URL(url, "ws://fixture").searchParams;
      this.speed = clampSpeed(q.get("speed") ?? 1);
      this.offset = Number(q.get("offset") ?? 0);
      this.timers = [];
      this.paused = false;
      this._later(() => {
        this.readyState = 1;
        this.onopen?.({});
        ready.then(
          () => this._later(() => this._begin(), loadDelayMs),
          (e) => {
            this._emit({ type: "error", detail: String(e?.message || e) });
            this._finish(1011);
          }
        );
      }, 0);
      if (dropAfterMs != null && drops === 0) {
        this._later(() => {
          drops++;
          this._finish(1006);
        }, dropAfterMs);
      }
    }

    _later(fn, ms) {
      const id = setTimeout(fn, ms);
      this.timers.push(id);
      return id;
    }

    _emit(msg) {
      if (this.readyState !== 1) return;
      // Копія через JSON: стор не має ділити об'єкти між з'єднаннями.
      this.onmessage?.({ data: JSON.stringify(msg) });
    }

    _clock() {
      if (this.paused) return this.anchorClock;
      return Math.min(this.anchorClock + (now() - this.anchorWall) * this.speed, prepared.endClock);
    }

    _begin() {
      const fx = prepared;
      const target = fx.sessionStart != null ? fx.sessionStart + this.offset * 1000 : fx.startClock;
      const start = Math.min(Math.max(target, fx.startClock), fx.endClock);
      this.anchorClock = start;
      this.anchorWall = now();
      this.pos = 0;
      // catch-up: записаний стан + події фікстури до start (без location/car_data,
      // для «станових» топіків лише останній запис на пілота) - як на бекенді.
      const extra = [];
      const latest = new Map();
      while (this.pos < fx.timeline.length && fx.timeline[this.pos].t <= start) {
        const { e } = fx.timeline[this.pos++];
        if (STREAM_TOPICS.has(e.topic)) continue;
        if (STATE_TOPICS.has(e.topic)) latest.set(`${e.topic}|${e.data?.driver_number}`, e);
        else extra.push(e);
      }
      const base = fx.catchupEvents.filter((e) => !STATE_TOPICS.has(e.topic) || !latest.has(`${e.topic}|${e.data?.driver_number}`));
      this._emit({
        ...fx.sessionMsg,
        replay: { start: toIso(start), end: toIso(fx.endClock), speed: this.speed },
      });
      this._emit({ type: "batch", catchup: true, clock: toIso(start), events: [...base, ...extra, ...latest.values()] });
      this.anchorWall = now();
      this.tick = setInterval(() => this._tick(), tickMs);
      this.timers.push(this.tick);
    }

    _tick() {
      if (this.paused || this.readyState !== 1) return;
      const fx = prepared;
      const clock = this._clock();
      const events = [];
      while (this.pos < fx.timeline.length && fx.timeline[this.pos].t <= clock) events.push(fx.timeline[this.pos++].e);
      if (events.length) this._emit({ type: "batch", clock: toIso(clock), events });
      if (clock >= fx.endClock && this.pos >= fx.timeline.length) {
        this._emit({ type: "end", clock: toIso(clock) });
        this._finish(1000);
      }
    }

    send(text) {
      if (this.readyState !== 1 || !prepared || this.anchorClock == null) return;
      let cmd;
      try {
        cmd = JSON.parse(text);
      } catch {
        cmd = null;
      }
      const reanchor = () => {
        this.anchorClock = this._clock();
        this.anchorWall = now();
      };
      if (cmd?.action === "pause") {
        reanchor();
        this.paused = true;
      } else if (cmd?.action === "resume") {
        if (this.paused) this.anchorWall = now();
        this.paused = false;
      } else if (cmd?.action === "speed" && Number.isFinite(Number(cmd.value))) {
        reanchor();
        this.speed = clampSpeed(cmd.value);
      } else {
        this._later(() => this._emit({ type: "error", detail: `Unknown replay command: ${cmd?.action}` }), 0);
        return;
      }
      this._later(() => this._emit({ type: "state", paused: this.paused, speed: this.speed, clock: toIso(this._clock()) }), 20);
    }

    _finish(code) {
      if (this.readyState === 3) return;
      for (const id of this.timers) {
        clearTimeout(id);
        clearInterval(id);
      }
      this.readyState = 3;
      this.onclose?.({ code });
    }

    close() {
      this._finish(1000);
    }
  };
}

/** Відомі фікстури. Імпорт динамічний і лише в dev - у production-бандл не потрапляють. */
export const FIXTURES = {
  "brazil-2026-race": () => import("../__fixtures__/brazil-2026-race.json"),
  "brazil-2026-quali": () => import("../__fixtures__/brazil-2026-quali.json"),
};

/** Фікстура за замовчуванням для коду сесії: Q/SQ → кваліфікація, інше → гонка. */
export function defaultFixtureFor(session) {
  return session === "Q" || session === "SQ" ? "brazil-2026-quali" : "brazil-2026-race";
}

/** Завантажує фікстуру за назвою (Promise<fixture>). */
export function loadFixture(name) {
  const load = FIXTURES[name];
  if (!load) return Promise.reject(new Error(`Невідома фікстура: ${name}`));
  return load().then((m) => m.default ?? m);
}

export class FixtureSource extends ReplaySource {
  /** opts: як у ReplaySource + {fixture (об'єкт або Promise), loadDelayMs, tickMs, dropAfterMs} */
  constructor({ fixture, loadDelayMs, tickMs, dropAfterMs, ...opts }) {
    super({
      ...opts,
      apiUrl: "ws://fixture",
      WebSocketImpl: makeFixtureSocket(fixture, { loadDelayMs, tickMs, dropAfterMs }),
    });
  }
}
