import { describe, it, expect } from "vitest";
import { timelineBounds, fraction, leaderFrom, lapStarts, lapAt, computeMarkers, fromStartTime, lastLapsTime } from "../timeline";

const S = Date.parse("2026-11-08T17:00:00Z");
const iso = (sec) => new Date(S + sec * 1000).toISOString();
// Лідер: коло 1 стартує на 200 с, далі по 90 с.
const lap = (n, dur = 90) => ({ lap_number: n, date_start: iso(200 + (n - 1) * 90), lap_duration: n === 1 ? null : dur });
const laps = [1, 2, 3, 4, 5].map((n) => lap(n));

describe("межі шкали", () => {
  it("ліва межа не пізніше запланованого старту (можна назад)", () => {
    expect(timelineBounds({ sessionStart: S, replayStart: S + 3000e3, replayEnd: S + 7200e3, earliestStart: S + 1320e3 })).toEqual({ lo: S, hi: S + 7200e3 });
    expect(timelineBounds({ sessionStart: S, replayStart: S - 600e3, replayEnd: S + 7200e3, earliestStart: null }).lo).toBe(S - 600e3);
  });
  it("у фікстурі - лише межі запису", () => {
    expect(timelineBounds({ sessionStart: S, replayStart: S + 1400e3, replayEnd: S + 1470e3, earliestStart: S + 1320e3, clampToRecording: true })).toEqual({ lo: S + 1320e3, hi: S + 1470e3 });
  });
  it("без даних - null", () => {
    expect(timelineBounds({ sessionStart: S, replayStart: null, replayEnd: null })).toBeNull();
  });
  it("частка", () => {
    const b = { lo: 0, hi: 100 };
    expect(fraction(25, b)).toBe(0.25);
    expect(fraction(-5, b)).toBe(0);
    expect(fraction(500, b)).toBe(1);
  });
});

describe("кола лідера", () => {
  it("лідер з position", () => {
    expect(leaderFrom({ 4: { position: 2 }, 63: { position: 1 } })).toBe(63);
    expect(leaderFrom({})).toBeNull();
  });
  it("старти кіл + старт поточного", () => {
    const st = lapStarts(laps);
    expect(st.map((s) => s.lap)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(st[5].t).toBe(S + (200 + 5 * 90) * 1000);
  });
  it("коло за моментом, але не в майбутньому", () => {
    const st = lapStarts(laps);
    expect(lapAt(st, S + 100e3)).toBeNull();
    expect(lapAt(st, S + 250e3)).toBe(1);
    expect(lapAt(st, S + 300e3)).toBe(2);
    expect(lapAt(st, S + 300e3, S + 299e3)).toBeNull();
  });
});

describe("мітки", () => {
  const rc = [
    // новіші першими
    { t: S + 900e3, category: "Flag", flag: "GREEN", scope: "Track", message: "TRACK CLEAR" },
    { t: S + 800e3, category: "SafetyCar", message: "SAFETY CAR IN THIS LAP" },
    { t: S + 600e3, category: "SafetyCar", message: "SAFETY CAR DEPLOYED" },
    { t: S + 500e3, category: "Flag", flag: "DOUBLE YELLOW", scope: "Sector", sector: 7, message: "DOUBLE YELLOW IN TRACK SECTOR 7" },
    { t: S + 1000e3, category: "Flag", flag: "RED", scope: "Track", message: "RED FLAG" },
  ].sort((a, b) => b.t - a.t);
  it("періоди SC і RED, жовті, піти, кола", () => {
    const m = computeMarkers({ leaderLaps: laps, raceControl: rc, pits: { 4: [{ t: S + 700e3 }], 1: [{ date: iso(650) }] }, isRace: true });
    expect(m.periods).toEqual([
      { kind: "SC", from: S + 600e3, to: S + 900e3 },
      { kind: "RED", from: S + 1000e3, to: null },
    ]);
    expect(m.yellows).toEqual([{ t: S + 500e3, double: true }]);
    expect(m.pits.map((p) => p.driverNumber)).toEqual([1, 4]);
    expect(m.laps.length).toBe(6);
  });
  it("поза гонкою кіл лідера немає", () => {
    expect(computeMarkers({ leaderLaps: laps, raceControl: [], pits: {}, isRace: false }).laps).toEqual([]);
  });
});

describe("пресети", () => {
  it("від старту: коло 1 лідера → SESSION STARTED → запланований старт", () => {
    expect(fromStartTime({ leaderLaps: laps, raceControl: [], sessionStart: S, isRace: true })).toBe(S + 200e3);
    const rc = [{ t: S + 30e3, category: "SessionStatus", message: "SESSION STARTED" }];
    expect(fromStartTime({ leaderLaps: [], raceControl: rc, sessionStart: S, isRace: true })).toBe(S + 30e3);
    expect(fromStartTime({ leaderLaps: laps, raceControl: rc, sessionStart: S, isRace: false })).toBe(S + 30e3);
    expect(fromStartTime({ leaderLaps: null, raceControl: [], sessionStart: S, isRace: true })).toBe(S);
  });
  it("останні 10 кіл: точно, якщо коло відоме", () => {
    const many = Array.from({ length: 60 }, (_, i) => lap(i + 1));
    expect(lastLapsTime({ leaderLaps: many, total: 60 })).toEqual({ t: S + (200 + 50 * 90) * 1000, lap: 51, estimated: false });
  });
  it("останні 10 кіл: оцінка за медіаною", () => {
    const r = lastLapsTime({ leaderLaps: laps, total: 20 });
    expect(r.estimated).toBe(true);
    expect(r.lap).toBe(11);
    expect(r.t).toBe(S + (200 + 10 * 90) * 1000);
  });
  it("приховано, якщо не обчислити", () => {
    expect(lastLapsTime({ leaderLaps: laps, total: null })).toBeNull();
    expect(lastLapsTime({ leaderLaps: [], total: 70 })).toBeNull();
    expect(lastLapsTime({ leaderLaps: laps, total: 8 })).toBeNull();
    expect(lastLapsTime({ leaderLaps: laps, total: 70, isRace: false })).toBeNull();
  });
});
