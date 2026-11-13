import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReplaySource, BACKOFF_MS, BUFFERING_MS } from "../sources/ReplaySource";
import { LiveSource } from "../sources/LiveSource";
import { FixtureSource, prepareFixture } from "../sources/FixtureSource";
import { createLiveStore } from "../store";
import race from "../__fixtures__/brazil-2026-race.json";

// Фейковий WebSocket: тест сам «відкриває», шле повідомлення й закриває.
class FakeWS {
  static instances = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.sent = [];
    FakeWS.instances.push(this);
  }
  send(text) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.readyState = 3;
  }
  // --- керування з тесту ---
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  emit(msg) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const SESSION = {
  type: "session",
  mode: "replay",
  session: { session_key: 1, session_name: "Race", session_type: "Race", date_start: "2026-11-08T17:00:00+00:00", date_end: "2026-11-08T19:00:00+00:00", year: 2026 },
  drivers: [
    { driver_number: 1, name_acronym: "NOR", full_name: "Lando NORRIS", team_name: "McLaren", team_colour: "F47600" },
    { driver_number: 81, name_acronym: "PIA", full_name: "Oscar PIASTRI", team_name: "McLaren", team_colour: "F47600" },
  ],
  track: null,
  replay: { start: "2026-11-08T17:10:00+00:00", end: "2026-11-08T19:00:00+00:00", speed: 2 },
};
const batch = (clock, events = [], extra = {}) => ({ type: "batch", clock, events, ...extra });
const pos = (n, p, date) => ({ topic: "position", data: { date, driver_number: n, position: p } });

let t = 0;
const now = () => t;
function setup(opts = {}) {
  FakeWS.instances = [];
  const store = createLiveStore({ throttleMs: 0, now });
  const src = new ReplaySource({ store, year: 2026, round: 20, session: "R", speed: 2, offset: 600, lang: "en", apiUrl: "https://api.example.com", WebSocketImpl: FakeWS, now, ...opts });
  return { store, src, ws: () => FakeWS.instances.at(-1), status: () => store.getState().playback.status };
}

beforeEach(() => {
  vi.useFakeTimers();
  t = 0;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("ReplaySource", () => {
  it("будує URL з VITE_API_URL (https→wss) і проходить connecting → loading → playing", () => {
    const { src, ws, status } = setup();
    src.start();
    expect(ws().url).toBe("wss://api.example.com/ws/replay/2026/20/R?speed=2&offset=600&lang=en");
    expect(status()).toBe("connecting");
    ws().open();
    expect(status()).toBe("loading");
    ws().emit(SESSION);
    expect(status()).toBe("playing");
    ws().emit(batch("2026-11-08T17:10:00+00:00", [pos(1, 1, "2026-11-08T17:09:00+00:00")], { catchup: true }));
    expect(src.lastClock).toBe(Date.parse("2026-11-08T17:10:00Z"));
  });

  it("buffering, якщо clock не росте > 2 с, і повернення до playing", () => {
    const { src, ws, status } = setup();
    src.start();
    ws().open();
    ws().emit(SESSION);
    ws().emit(batch("2026-11-08T17:10:00+00:00", [], { catchup: true }));
    t += BUFFERING_MS + 100;
    vi.advanceTimersByTime(600);
    expect(status()).toBe("buffering");
    t += 100;
    ws().emit(batch("2026-11-08T17:10:01+00:00", [pos(1, 1, "2026-11-08T17:10:01+00:00")]));
    expect(status()).toBe("playing");
  });

  it("pause/resume/speed: команди на сервер і оптимістичний стан", () => {
    const { src, ws, status, store } = setup();
    src.start();
    ws().open();
    ws().emit(SESSION);
    src.pause();
    expect(status()).toBe("paused");
    expect(store.getState().playback.paused).toBe(true);
    src.setSpeed(50);
    src.resume();
    expect(ws().sent).toEqual([{ action: "pause" }, { action: "speed", value: 20 }, { action: "resume" }]);
    expect(status()).toBe("playing");
    // запізніла відповідь state{paused:true} не перебиває новішу дію resume
    ws().emit({ type: "state", paused: true, speed: 20, clock: "2026-11-08T17:10:02+00:00" });
    expect(status()).toBe("playing");
  });

  it("seek: нове з'єднання з offset, пізні повідомлення старого відкидаються", () => {
    const { src, ws, store } = setup();
    src.start();
    const old = ws();
    old.open();
    old.emit(SESSION);
    old.emit(batch("2026-11-08T17:10:00+00:00", [pos(1, 1, "2026-11-08T17:10:00+00:00")], { catchup: true }));
    src.seek(1800);
    expect(store.getState().playback.seeking).toEqual({ offset: 1800, target: Date.parse("2026-11-08T17:30:00Z") });
    const fresh = ws();
    expect(fresh).not.toBe(old);
    expect(fresh.url).toContain("offset=1800");
    // старий сокет ще щось надсилає - ігнорується
    old.emit(batch("2026-11-08T17:10:01+00:00", [pos(81, 1, "2026-11-08T17:10:01+00:00")]));
    expect(store.getState().position[81]).toBeUndefined();
    old.onclose?.({ code: 1000 }); // обробники старого сокета вже зняті
    expect(store.getState().playback.status).toBe("connecting");
    fresh.open();
    fresh.emit({ ...SESSION, replay: { ...SESSION.replay, start: "2026-11-08T17:30:00+00:00" } });
    expect(store.getState().playback.seeking).toBeNull();
    expect(store.getState().position).toEqual({}); // стор скинуто новою session
    fresh.emit(batch("2026-11-08T17:30:00+00:00", [pos(81, 1, "2026-11-08T17:29:00+00:00")], { catchup: true }));
    expect(store.getState().position[81].position).toBe(1);
  });

  it("обрив без end: lost → backoff 1/2/4/8/15 с → offset з останнього clock", () => {
    const { src, ws, status, store } = setup();
    src.start();
    ws().open();
    ws().emit(SESSION);
    ws().emit(batch("2026-11-08T17:10:00+00:00", [], { catchup: true }));
    ws().emit(batch("2026-11-08T17:25:30+00:00", [pos(1, 1, "2026-11-08T17:25:30+00:00")]));
    ws().drop();
    expect(status()).toBe("lost");
    expect(store.getState().playback.reconnect).toMatchObject({ attempt: 1, delayMs: 1000 });
    const delays = [];
    for (let i = 0; i < 6; i++) {
      const before = FakeWS.instances.length;
      const d = store.getState().playback.reconnect.delayMs;
      delays.push(d);
      vi.advanceTimersByTime(d - 1);
      expect(FakeWS.instances.length).toBe(before);
      vi.advanceTimersByTime(1);
      expect(FakeWS.instances.length).toBe(before + 1);
      // 17:25:30 − 17:00:00 = 1530 с
      expect(ws().url).toContain("offset=1530");
      ws().drop(); // сервер усе ще недоступний
    }
    expect(delays).toEqual([...BACKOFF_MS, 15000]);
    // успішне підключення скидає лічильник спроб
    vi.advanceTimersByTime(15000);
    ws().open();
    ws().emit(SESSION);
    expect(status()).toBe("playing");
    expect(src.attempt).toBe(0);
  });

  it("після error немає автопідключення; retry() підключається знову", () => {
    const { src, ws, status, store } = setup();
    src.start();
    ws().open();
    ws().emit({ type: "error", detail: "Could not start the session replay: boom" });
    ws().drop(1011);
    expect(status()).toBe("error");
    expect(store.getState().playback.error).toMatch(/boom/);
    const n = FakeWS.instances.length;
    vi.advanceTimersByTime(60000);
    expect(FakeWS.instances.length).toBe(n);
    src.retry();
    expect(FakeWS.instances.length).toBe(n + 1);
    expect(status()).toBe("connecting");
    expect(store.getState().playback.error).toBeNull();
  });

  it("end → ended без перепідключення; close() глушить усе", () => {
    const { src, ws, status } = setup();
    src.start();
    ws().open();
    ws().emit(SESSION);
    ws().emit({ type: "end", clock: "2026-11-08T19:00:00+00:00" });
    ws().drop(1000);
    expect(status()).toBe("ended");
    const n = FakeWS.instances.length;
    vi.advanceTimersByTime(20000);
    expect(FakeWS.instances.length).toBe(n);
    src.close();
    expect(ws().readyState).toBe(3);
  });

  it("пауза переживає перепідключення", () => {
    const { src, ws, status } = setup();
    src.start();
    ws().open();
    ws().emit(SESSION);
    src.pause();
    ws().drop();
    vi.advanceTimersByTime(1000);
    ws().open();
    ws().emit(SESSION);
    expect(ws().sent).toEqual([{ action: "pause" }]);
    expect(status()).toBe("paused");
  });

  it("LiveSource: інша адреса, без speed/seek/pause", () => {
    const { store } = setup();
    const live = new LiveSource({ store, apiUrl: "http://localhost:8000", lang: "uk", WebSocketImpl: FakeWS, now });
    live.start();
    expect(FakeWS.instances.at(-1).url).toBe("ws://localhost:8000/ws/live?lang=uk");
    live.pause();
    live.setSpeed(5);
    live.seek(100);
    expect(FakeWS.instances.at(-1).sent).toEqual([]);
    expect(live.capabilities).toEqual({ pause: false, speed: false, seek: false });
  });
});

describe("FixtureSource", () => {
  it("prepareFixture: session, catch-up, впорядкований timeline", () => {
    const fx = prepareFixture(race);
    expect(fx.sessionMsg.type).toBe("session");
    expect(fx.catchupEvents.length).toBeGreaterThan(100);
    for (let i = 1; i < fx.timeline.length; i++) expect(fx.timeline[i].t).toBeGreaterThanOrEqual(fx.timeline[i - 1].t);
    expect(fx.endClock).toBeGreaterThan(fx.startClock);
  });

  it("програє фікстуру як бекенд: session → catch-up → batch → pause → seek → end", async () => {
    const store = createLiveStore({ throttleMs: 0 });
    const src = new FixtureSource({ store, year: 2026, round: 20, session: "R", speed: 20, offset: 0, lang: "uk", fixture: race, loadDelayMs: 10 });
    src.start();
    const st = () => store.getState().playback;
    expect(st().status).toBe("connecting");
    await vi.advanceTimersByTimeAsync(5);
    expect(st().status).toBe("loading");
    await vi.advanceTimersByTimeAsync(20);
    expect(st().status).toBe("playing");
    expect(store.getState().driverNumbers).toHaveLength(22);
    const c0 = st().clock;
    await vi.advanceTimersByTimeAsync(1000);
    expect(st().clock).toBeGreaterThan(c0 + 10000); // ×20: ~20 с сесії за 1 с
    expect(store.getTrail(1).size).toBeGreaterThan(5);

    src.pause();
    await vi.advanceTimersByTimeAsync(100);
    const frozen = st().clock;
    await vi.advanceTimersByTimeAsync(1000);
    expect(st().clock).toBe(frozen);
    expect(st().status).toBe("paused");

    // перемотування за межі запису обмежується кінцем фікстури
    src.resume();
    const fx = prepareFixture(race);
    src.seek((fx.endClock - fx.sessionStart) / 1000 - 5);
    expect(st().seeking).not.toBeNull();
    await vi.advanceTimersByTimeAsync(50);
    expect(st().seeking).toBeNull();
    await vi.advanceTimersByTimeAsync(2000);
    expect(st().status).toBe("ended");
    src.close();
  });

  it("dropAfterMs імітує обрив: lost → перепідключення з того ж місця", async () => {
    const store = createLiveStore({ throttleMs: 0 });
    const src = new FixtureSource({ store, year: 2026, round: 20, session: "R", speed: 5, offset: 0, lang: "uk", fixture: race, loadDelayMs: 10, dropAfterMs: 1500 });
    src.start();
    await vi.advanceTimersByTimeAsync(1490);
    const before = src.lastClock;
    expect(before).not.toBeNull();
    await vi.advanceTimersByTimeAsync(20);
    expect(store.getState().playback.status).toBe("lost");
    await vi.advanceTimersByTimeAsync(1000 + 50);
    expect(store.getState().playback.status).toBe("playing");
    expect(store.getState().playback.clock).toBeGreaterThanOrEqual(before - 1000);
    src.close();
  });
});
