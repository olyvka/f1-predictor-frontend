import { describe, it, expect } from "vitest";
import {
  gearLabel,
  barPercent,
  isBraking,
  formatRpm,
  sampleAt,
  pickTelemetrySample,
  isStale,
  timingKind,
  miniSectorKind,
  lapMiniSectors,
  lapPitFlag,
  compoundForLap,
  splitSegments,
  decimate,
  brakeZones,
  maxSpeed,
  traceState,
  positionDelta,
  topFactors,
  signedImpact,
  modelPairs,
  percent,
} from "../helpers";
import { DASH } from "../../../../live/format";

describe("телеметрія", () => {
  it("передача: 0 → N, null → —", () => {
    expect(gearLabel(0)).toBe("N");
    expect(gearLabel(7)).toBe("7");
    expect(gearLabel(null)).toBe(DASH);
  });
  it("смуги обмежені 0..100", () => {
    expect(barPercent(104)).toBe(100);
    expect(barPercent(-3)).toBe(0);
    expect(barPercent(6500, 13000)).toBe(50);
    expect(barPercent(null)).toBe(0);
  });
  it("гальмо вкл/викл (0/100/104)", () => {
    expect(isBraking(0)).toBe(false);
    expect(isBraking(100)).toBe(true);
    expect(isBraking(104)).toBe(true);
    expect(isBraking(null)).toBe(false);
  });
  it("оберти коротко", () => {
    expect(formatRpm(11234)).toBe("11.2k");
    expect(formatRpm(undefined)).toBe(DASH);
  });
  it("sampleAt - останній семпл не пізніше t", () => {
    const s = [{ t: 10 }, { t: 20 }, { t: 30 }];
    expect(sampleAt(s, 5)).toBeNull();
    expect(sampleAt(s, 10)).toBe(s[0]);
    expect(sampleAt(s, 25)).toBe(s[1]);
    expect(sampleAt(s, 99)).toBe(s[2]);
    expect(sampleAt([], 10)).toBeNull();
  });
  it("pickTelemetrySample шукає й у попередньому колі", () => {
    const tel = { current: [{ t: 100 }, { t: 110 }], previous: [{ t: 80 }, { t: 90 }] };
    expect(pickTelemetrySample(tel, 105)).toBe(tel.current[0]);
    expect(pickTelemetrySample(tel, 95)).toBe(tel.previous[1]);
    expect(pickTelemetrySample(null, 95)).toBeNull();
  });
  it("stale > 3 с", () => {
    expect(isStale(1000, 3500)).toBe(false);
    expect(isStale(1000, 4001)).toBe(true);
    expect(isStale(null, 4000)).toBe(true);
    expect(isStale(1000, null)).toBe(false);
  });
});

describe("сектори й міні-сектори", () => {
  it("фіолетовий / зелений / без покращення", () => {
    expect(timingKind(22.1, 22.1, 22.1)).toBe("session");
    expect(timingKind(22.3, 22.3, 22.1)).toBe("personal");
    expect(timingKind(22.5, 22.3, 22.1)).toBe("none");
    expect(timingKind(null, 22.3, 22.1)).toBeNull();
  });
  it("коди OpenF1", () => {
    expect(miniSectorKind(2048)).toBe("yellow");
    expect(miniSectorKind(2049)).toBe("green");
    expect(miniSectorKind(2051)).toBe("purple");
    expect(miniSectorKind(2064)).toBe("pit");
    for (const c of [0, null, 2050, 2052, 2068]) expect(miniSectorKind(c)).toBe("none");
  });
  it("смужка лише якщо є хоч один відомий код", () => {
    expect(lapMiniSectors({ segments_sector_1: null, segments_sector_2: null, segments_sector_3: null })).toBeNull();
    expect(lapMiniSectors({ segments_sector_1: [0, null], segments_sector_2: [2050] })).toBeNull();
    expect(lapMiniSectors({ segments_sector_1: [null, 2048], segments_sector_2: [2051], segments_sector_3: null })).toEqual([["none", "yellow"], ["purple"], []]);
  });
  it("коло з піт-лейном", () => {
    expect(lapPitFlag({ is_pit_out_lap: true })).toBe("out");
    expect(lapPitFlag({ segments_sector_3: [2048, 2064] })).toBe("in");
    expect(lapPitFlag({ segments_sector_1: [2048] })).toBeNull();
  });
  it("компаунд кола зі стінтів", () => {
    const stints = [
      { stint_number: 1, lap_start: 1, lap_end: 20, compound: "MEDIUM" },
      { stint_number: 2, lap_start: 21, lap_end: null, compound: "HARD" },
    ];
    expect(compoundForLap(stints, 5)).toBe("MEDIUM");
    expect(compoundForLap(stints, 30)).toBe("HARD");
    expect(compoundForLap([], 3)).toBeNull();
  });
});

describe("траса швидкості", () => {
  it("розрив лінії на пропуску або поверненні f", () => {
    const pts = [{ f: 0.1, speed: 1 }, { f: 0.12, speed: 1 }, { f: 0.3, speed: 1 }, { f: 0.31, speed: 1 }, { f: 0.05, speed: 1 }];
    expect(splitSegments(pts).map((s) => s.length)).toEqual([2, 2, 1]);
  });
  it("децимація зберігає мін/макс у колонці", () => {
    const pts = Array.from({ length: 1000 }, (_, i) => ({ f: i / 1000, speed: i === 503 ? 999 : i === 507 ? 1 : 200 }));
    const out = decimate(pts, 10);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.some((p) => p.speed === 999)).toBe(true);
    expect(out.some((p) => p.speed === 1)).toBe(true);
    const few = [{ f: 0.1, speed: 1 }];
    expect(decimate(few, 300)).toBe(few);
  });
  it("зони гальмування зливаються", () => {
    const pts = [
      { f: 0.1, brake: 0 },
      { f: 0.11, brake: 100 },
      { f: 0.12, brake: 100 },
      { f: 0.13, brake: 0 },
      { f: 0.5, brake: 104 },
      { f: 0.6, brake: 0 },
    ];
    const z = brakeZones(pts);
    expect(z.length).toBe(2);
    expect(z[0]).toEqual([0.11, 0.13]);
    expect(z[1][0]).toBe(0.5);
    expect(z[1][1]).toBeCloseTo(0.502); // наступний семпл задалеко - коротка зона
  });
  it("макс. швидкість і стан", () => {
    expect(maxSpeed([{ speed: 100 }, { speed: 320 }])).toBe(320);
    expect(maxSpeed([])).toBeNull();
    expect(traceState(null)).toBe("empty");
    expect(traceState({ current: [], previous: [] })).toBe("empty");
    expect(traceState({ current: [{}], previous: [], partial: true })).toBe("afterSeek");
    expect(traceState({ current: [{}], previous: [{}], partial: true })).toBe("partial");
    expect(traceState({ current: [{}], previous: [{}], partial: false })).toBe("ok");
  });
});

describe("модель vs гонка", () => {
  it("Δ = прогноз − поточне", () => {
    expect(positionDelta(6, 3)).toBe(3);
    expect(positionDelta(3, 6)).toBe(-3);
    expect(positionDelta(null, 6)).toBeNull();
  });
  it("топ-фактори за |impact|, решта - до «інших»", () => {
    const e = { other: 0.2, factors: [{ feature: "a", impact: 0.1 }, { feature: "b", impact: -3 }, { feature: "c", impact: 1 }] };
    const r = topFactors(e, 2);
    expect(r.factors.map((f) => f.feature)).toEqual(["b", "c"]);
    expect(r.other).toBeCloseTo(0.3);
    expect(r.max).toBe(3);
    expect(topFactors(null)).toBeNull();
  });
  it("знак як на сторінці аналізу", () => {
    expect(signedImpact(1.26)).toBe("+1.3");
    expect(signedImpact(-0.44)).toBe("−0.4");
    expect(signedImpact(0.01)).toBe("0.0");
  });
  it("пари без зійшлих і незіставлених", () => {
    const rows = [
      { driverNumber: 1, position: 1, gone: false },
      { driverNumber: 2, position: 2, gone: true },
      { driverNumber: 3, position: 3, gone: false },
      { driverNumber: 4, position: null, gone: false },
    ];
    const byNumber = { 1: { predicted_position: 2 }, 2: { predicted_position: 1 }, 4: { predicted_position: 3 } };
    expect(modelPairs(rows, byNumber)).toEqual([{ position: 1, predicted: 2 }]);
    expect(percent(0.124)).toBe(12);
    expect(percent(undefined)).toBeNull();
  });
});
