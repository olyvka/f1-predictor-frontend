import { describe, it, expect, vi } from "vitest";
import { createLiveStore, LIMITS, buildTower, renderDelayMs, isPitLap, carsMentioned } from "../store";
import { parseTime } from "../time";
import race from "../__fixtures__/brazil-2026-race.json";
import quali from "../__fixtures__/brazil-2026-quali.json";

const msgs = (fx) => fx.messages.map((m) => m.msg);
const sessionOf = (fx) => msgs(fx).find((m) => m.type === "session");
const catchupOf = (fx) => msgs(fx).find((m) => m.type === "batch" && m.catchup);

function makeStore(opts = {}) {
  let t = 0;
  const store = createLiveStore({ throttleMs: 0, now: () => t, ...opts });
  return { store, tick: (ms) => (t += ms) };
}

function play(store, fx, upto = Infinity) {
  let i = 0;
  for (const m of msgs(fx)) {
    if (i++ >= upto) break;
    store.receive(m);
  }
}

// Синтетичний batch поверх сесії фікстури.
const batch = (clock, events) => ({ type: "batch", clock, events });

describe("store: сесія і catch-up", () => {
  it("session нормалізує пілотів, напарників, кольори і контур", () => {
    const { store } = makeStore();
    store.receive(sessionOf(race));
    const s = store.getState();
    expect(s.mode).toBe("replay");
    expect(s.driverNumbers).toHaveLength(22);
    const nor = s.drivers[1];
    expect(nor.acronym).toBe("NOR");
    expect(nor.color).toMatch(/^#[0-9A-F]{6}$/);
    // у кожної команди рівно один «другий» напарник
    const second = Object.values(s.drivers).filter((d) => d.isSecondTeammate);
    expect(second.length).toBe(11);
    expect(s.drivers[nor.teammate].teammate).toBe(1);
    expect(s.track.geometry.length).toBeGreaterThan(1000);
    expect(s.sessionStart).toBe(parseTime("2026-11-08T17:00:00+00:00"));
    expect(s.playback.clock).toBe(parseTime(s.replay.start));
  });

  it("catch-up гонки дає позиції, інтервали, кола, стінти, погоду і збільшує epoch", () => {
    const { store } = makeStore();
    store.receive(sessionOf(race));
    const epoch0 = store.getState().playback.epoch;
    store.receive(catchupOf(race));
    const s = store.getState();
    expect(s.playback.epoch).toBe(epoch0 + 1);
    expect(Object.keys(s.position)).toHaveLength(22);
    expect(Object.keys(s.intervals).length).toBeGreaterThan(15);
    expect(s.weather.air_temperature).toBeTypeOf("number");
    expect(s.raceControl.length).toBeGreaterThan(0);
    // новіші першими
    for (let i = 1; i < s.raceControl.length; i++) expect(s.raceControl[i - 1].t).toBeGreaterThanOrEqual(s.raceControl[i].t);
    const tower = store.getTower();
    expect(tower.instant).toBe(true);
    expect(tower.isRace).toBe(true);
    expect(tower.rows[0].position).toBe(1);
    expect(tower.rows[0].isLeader).toBe(true);
    expect(tower.leaderLap).toBeGreaterThan(5);
    // позиції по зростанню, без дублікатів
    const pos = tower.rows.map((r) => r.position);
    expect(pos).toEqual([...pos].sort((a, b) => a - b));
    expect(new Set(pos).size).toBe(22);
    // шина і вік у кожного, хто має стінт
    for (const r of tower.rows) if (r.stint) expect(r.tyreAge).toBeGreaterThanOrEqual(0);
    // кола відсортовані за lap_number
    for (const arr of Object.values(s.laps)) for (let i = 1; i < arr.length; i++) expect(arr[i].lap_number).toBeGreaterThan(arr[i - 1].lap_number);
  });

  it("повна фікстура: порядок подій, clock росте, найкращі кола консистентні", () => {
    const { store } = makeStore();
    let lastClock = -Infinity;
    for (const m of msgs(race)) {
      store.receive(m);
      const c = store.getState().playback.clock;
      if (c != null) {
        expect(c).toBeGreaterThanOrEqual(lastClock);
        lastClock = c;
      }
    }
    const s = store.getState();
    const all = Object.values(s.laps).flat().map((l) => l.lap_duration).filter((v) => v != null);
    expect(s.best.lap.time).toBe(Math.min(...all));
    const tower = store.getTower();
    expect(tower.instant).toBe(false);
    const best = tower.rows.find((r) => r.hasSessionBest);
    expect(best.bestLapTime).toBe(s.best.lap.time);
    expect(s.carData[1].speed).toBeTypeOf("number");
  });

  it("кваліфікація: без intervals, gapToBest замість відставання", () => {
    const { store } = makeStore();
    play(store, quali);
    const tower = store.getTower();
    expect(tower.isRace).toBe(false);
    expect(tower.hasIntervals).toBe(false);
    const withLaps = tower.rows.filter((r) => r.bestLapTime != null);
    expect(withLaps.length).toBeGreaterThan(10);
    expect(Math.min(...withLaps.map((r) => r.gapToBest))).toBe(0);
    for (const r of withLaps) expect(r.gapToBest).toBeGreaterThanOrEqual(0);
    // хтось у боксах (за геометрією), і він не «на трасі»
    expect(tower.rows.some((r) => r.inPit)).toBe(true);
  });
});

describe("store: редюсер подій", () => {
  function started() {
    const { store, tick } = makeStore();
    store.receive(sessionOf(race));
    store.receive(catchupOf(race));
    return { store, tick };
  }

  it("null-поля і рядкові інтервали (+1 LAP) не ламають рядок", () => {
    const { store } = started();
    store.receive(
      batch("2026-11-08T17:22:05+00:00", [
        { topic: "intervals", data: { date: "2026-11-08T17:22:04+00:00", driver_number: 1, gap_to_leader: "+1 LAP", interval: null } },
        { topic: "laps", data: { driver_number: 1, lap_number: 99, date_start: null, lap_duration: null, duration_sector_1: null, segments_sector_1: null } },
        { topic: "position", data: { date: "2026-11-08T17:22:04+00:00", driver_number: 1, position: null } },
      ])
    );
    const row = store.getTower().rows.find((r) => r.driverNumber === 1);
    expect(row.gapToLeader).toBe("+1 LAP");
    expect(row.interval).toBeNull();
    expect(row.lastLap.lap_number).toBe(99);
    expect(row.lastLapTime).toBeNull();
    expect(row.position).toBeNull();
    // без позиції - у кінці таблиці
    expect(store.getTower().rows.at(-1).driverNumber).toBe(1);
  });

  it("повторне коло і стінт замінюють, а не дублюються", () => {
    const { store } = started();
    const before = store.getState().laps[1];
    const n = before.length;
    const last = before.at(-1);
    store.receive(batch("2026-11-08T17:22:05+00:00", [{ topic: "laps", data: { ...last, lap_duration: 70.001 } }]));
    const after = store.getState().laps[1];
    expect(after).toHaveLength(n);
    expect(after.at(-1).lap_duration).toBe(70.001);
    expect(after).not.toBe(before); // copy-on-write
    const stints = store.getState().stints[1];
    store.receive(batch("2026-11-08T17:22:06+00:00", [{ topic: "stints", data: { ...stints[0], compound: "WET" } }]));
    expect(store.getState().stints[1]).toHaveLength(stints.length);
    expect(store.getState().stints[1][0].compound).toBe("WET");
    // повтор піт-стопу (після перепідключення) не дублюється
    const pit = { date: "2026-11-08T17:22:06+00:00", driver_number: 1, lap_number: 12, lane_duration: 22.1, stop_duration: null, pit_duration: 22.1 };
    store.receive(batch("2026-11-08T17:22:07+00:00", [{ topic: "pit", data: pit }]));
    store.receive(batch("2026-11-08T17:22:08+00:00", [{ topic: "pit", data: pit }]));
    expect(store.getTower().rows.find((r) => r.driverNumber === 1).pitCount).toBe(1);
  });

  it("race control: ліміт 200, статус траси, сині прапори й ⚠ у таблиці", () => {
    const { store } = started();
    const base = parseTime("2026-11-08T17:22:00+00:00");
    const events = [];
    for (let i = 0; i < 250; i++) {
      events.push({ topic: "race_control", data: { date: new Date(base + i * 10).toISOString(), category: "Other", flag: null, scope: null, sector: null, message: `MSG ${i}` } });
    }
    events.push({ topic: "race_control", data: { date: new Date(base + 3000).toISOString(), category: "SafetyCar", flag: null, scope: null, message: "SAFETY CAR DEPLOYED" } });
    events.push({ topic: "race_control", data: { date: new Date(base + 3001).toISOString(), category: "Flag", flag: "BLUE", scope: "Driver", driver_number: 1, message: "WAVED BLUE FLAG FOR CAR 1 (NOR)" } });
    events.push({ topic: "race_control", data: { date: new Date(base + 3002).toISOString(), category: "Other", flag: null, scope: null, driver_number: null, message: "CAR 12 (ANT) TIME 1:12.345 DELETED - TRACK LIMITS" } });
    store.receive(batch(new Date(base + 4000).toISOString(), events));
    const s = store.getState();
    expect(s.raceControl).toHaveLength(LIMITS.raceControl);
    expect(s.raceControl[0].message).toMatch(/DELETED/);
    expect(s.trackStatus.state).toBe("SC");
    const tower = store.getTower();
    expect(tower.rows.find((r) => r.driverNumber === 1).blueFlag).toBe(true);
    expect(tower.rows.find((r) => r.driverNumber === 12).warning.message).toMatch(/TRACK LIMITS/);
    // через 11 с синій прапор зникає
    store.receive(batch(new Date(base + 14500).toISOString(), [{ topic: "location", data: { date: new Date(base + 14500).toISOString(), driver_number: 1, x: 0, y: 0, z: 0 } }]));
    expect(store.getTower().rows.find((r) => r.driverNumber === 1).blueFlag).toBe(false);
  });

  it("буфер location обмежений, car_data поточного кола переходить у попереднє", () => {
    const { store } = started();
    const base = parseTime("2026-11-08T17:22:00+00:00");
    const ev = [];
    for (let i = 0; i < 300; i++) {
      const date = new Date(base + i * 270).toISOString();
      ev.push({ topic: "location", data: { date, driver_number: 1, x: i, y: 0, z: 0 } });
      ev.push({ topic: "car_data", data: { date, driver_number: 1, speed: 200 + (i % 50), throttle: 100, brake: 0, n_gear: 7, rpm: 11000, drs: null } });
    }
    store.receive(batch(new Date(base + 300 * 270).toISOString(), ev));
    expect(store.getTrail(1).size).toBe(LIMITS.trailCapacity);
    const tel = store.getTelemetryLap(1);
    expect(tel.current.length).toBe(300);
    // завершилось коло, що почалось у base і тривало 40 с
    store.receive(
      batch(new Date(base + 300 * 270 + 100).toISOString(), [
        { topic: "laps", data: { driver_number: 1, lap_number: 200, date_start: new Date(base).toISOString(), lap_duration: 40, duration_sector_1: 13 } },
      ])
    );
    const tel2 = store.getTelemetryLap(1);
    expect(tel2.previous.every((s) => s.t < base + 40000)).toBe(true);
    expect(tel2.current.every((s) => s.t >= base + 40000)).toBe(true);
    expect(tel2.previous.length + tel2.current.length).toBe(300);
    expect(tel2.lapNumber).toBe(201);
  });

  it("високочастотні події не сповіщають канал table", () => {
    const { store } = started();
    const onTable = vi.fn();
    const onTel = vi.fn();
    store.subscribe("table", onTable);
    store.subscribe("telemetry", onTel);
    const base = parseTime("2026-11-08T17:22:01+00:00");
    const ev = [];
    for (let i = 0; i < 40; i++) {
      ev.push({ topic: "car_data", data: { date: new Date(base + i * 5).toISOString(), driver_number: 1, speed: 250, throttle: 100, brake: 0, n_gear: 8, rpm: 11500, drs: null } });
    }
    const v0 = store.getVersion("table");
    store.receive(batch(new Date(base + 300).toISOString(), ev));
    expect(onTel).toHaveBeenCalledTimes(1); // один раз на batch, а не на подію
    expect(store.getVersion("table")).toBe(v0);
    expect(onTable).not.toHaveBeenCalled();
  });

  it("throttle: сповіщення не частіше ніж throttleMs", () => {
    vi.useFakeTimers();
    try {
      let t = 0;
      const store = createLiveStore({ throttleMs: 200, now: () => t });
      store.receive(sessionOf(race));
      store.receive(catchupOf(race));
      const cb = vi.fn();
      store.subscribe("table", cb);
      const base = parseTime("2026-11-08T17:22:01+00:00");
      for (let i = 0; i < 5; i++) {
        t += 10;
        store.receive(batch(new Date(base + i).toISOString(), [{ topic: "intervals", data: { date: new Date(base + i).toISOString(), driver_number: 1, gap_to_leader: i, interval: i } }]));
      }
      expect(cb.mock.calls.length).toBeLessThanOrEqual(1);
      t += 300;
      vi.advanceTimersByTime(300);
      expect(cb.mock.calls.length).toBe(1);
      expect(store.getState().intervals[1].gap_to_leader).toBe(4);
    } finally {
      vi.useRealTimers();
    }
  });

  it("фокус переживає нову session (перемотування), невідомий пілот - null", () => {
    const { store } = started();
    store.setFocus(44);
    store.setRival(1);
    store.receive(sessionOf(race));
    expect(store.getState().focus).toBe(44);
    expect(store.getState().rival).toBe(1);
    store.setFocus(999);
    expect(store.getState().focus).toBeNull();
    store.toggleFocus(1);
    expect(store.getState().focus).toBe(1);
    expect(store.getState().rival).toBeNull(); // суперник не може бути фокусом
    store.toggleFocus(1);
    expect(store.getState().focus).toBeNull();
  });
});

describe("store: годинник і карта", () => {
  it("локальний годинник: росте при playing, стоїть на паузі, оптимістична пауза", () => {
    const { store, tick } = makeStore();
    store.receive(sessionOf(race));
    store.receive(catchupOf(race));
    store.setConnection({ status: "playing" });
    const c0 = store.getState().playback.clock;
    store.setSpeed(5);
    tick(200);
    expect(store.getClockLocal()).toBe(c0 + 1000);
    store.setPaused(true);
    const frozen = store.getClockLocal();
    tick(500);
    expect(store.getClockLocal()).toBe(frozen);
    expect(store.getRenderTime()).toBe(frozen - renderDelayMs(5));
    expect(renderDelayMs(1)).toBe(600);
    expect(renderDelayMs(10)).toBe(4000);
  });

  it("getCarsAt інтерполює, перевикористовує об'єкти і бачить піт-лейн", () => {
    const { store } = makeStore();
    play(store, race, 30);
    const clock = store.getState().playback.clock;
    const cars = store.getCarsAt(clock - 1000);
    expect(cars).toHaveLength(22);
    const ok = cars.filter((c) => c.ok);
    expect(ok.length).toBeGreaterThan(18);
    for (const c of ok) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(c.lapFraction).toBeGreaterThanOrEqual(0);
      expect(c.lapFraction).toBeLessThanOrEqual(1);
    }
    const again = store.getCarsAt(clock - 900);
    expect(again).toBe(cars); // той самий масив
    expect(again[0]).toBe(cars[0]);
    expect(store.getSeenPoints().length).toBeGreaterThan(10);
  });

  it("траса швидкості: частки кола 0..1 після завершеного кола", () => {
    const { store } = makeStore();
    play(store, race);
    const withPrev = store.getState().driverNumbers.map((n) => store.getSpeedTrace(n)).filter((t) => t && t.previous.length > 50);
    expect(withPrev.length).toBeGreaterThan(5);
    const tr = withPrev[0];
    for (const p of [...tr.previous, ...tr.current]) {
      expect(p.f).toBeGreaterThanOrEqual(0);
      expect(p.f).toBeLessThanOrEqual(1);
    }
    // попереднє коло вкриває майже всю частку кола
    const fs = tr.previous.map((p) => p.f);
    expect(Math.max(...fs) - Math.min(...fs)).toBeGreaterThan(0.8);
  });

  it("сход: немає location > 30 с → gone", () => {
    const { store } = makeStore();
    play(store, race, 3);
    const clock = store.getState().playback.clock;
    store.receive(batch(new Date(clock + 31000).toISOString(), [{ topic: "location", data: { date: new Date(clock + 31000).toISOString(), driver_number: 1, x: 0, y: 0, z: 0 } }]));
    const tower = store.getTower();
    expect(tower.rows.find((r) => r.driverNumber === 1).gone).toBe(false);
    expect(tower.rows.filter((r) => r.gone).length).toBeGreaterThan(15);
  });
});

describe("store: допоміжне", () => {
  it("isPitLap і carsMentioned", () => {
    expect(isPitLap({ is_pit_out_lap: true })).toBe(true);
    expect(isPitLap({ segments_sector_3: [2048, 2064] })).toBe(true);
    expect(isPitLap({ segments_sector_1: [2049] })).toBe(false);
    expect(isPitLap(null)).toBe(false);
    expect(carsMentioned("TURN 3 INCIDENT INVOLVING CARS 12 (ANT) AND 1 (VER) NOTED")).toEqual([12, 1]);
  });
  it("buildTower на порожньому стані", () => {
    const { store } = makeStore();
    expect(buildTower(store.getState()).rows).toEqual([]);
  });
});
