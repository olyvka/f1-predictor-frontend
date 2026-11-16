import { describe, it, expect } from "vitest";
import {
  columnsFor,
  layoutHasPrediction,
  displayRows,
  sameMembers,
  orderDeltas,
  mergeArrows,
  nextArrowExpiry,
  reorderDelay,
  raceGapCell,
  qualiDeltaCell,
  qualiCompactCell,
  lastLapKind,
  bestLapKind,
  sectorKind,
  isOutLap,
  rowChips,
  intervalsStale,
  pitSummary,
  latestQualifyingPhase,
  eliminationRange,
  inRange,
  isQualifyingSession,
  predictionCell,
  positionAnnouncement,
  freshnessState,
  sessionNameKey,
  trackChip,
  describeBanner,
  MOTION,
} from "../logic";

// Простий t: ключ + параметри, щоб перевіряти, який рядок вибрано.
const t = (key, opts) => {
  if (key === "live.common.lapsDown") return `+${opts.count} lap`;
  if (key === "live.common.leader") return "Leader";
  if (key === "live.tower.gap.reference") return "Ref";
  return opts ? `${key}:${JSON.stringify(opts)}` : key;
};

const row = (o = {}) => ({
  driverNumber: 1,
  driver: { acronym: "AAA" },
  position: 2,
  isLeader: false,
  gapToLeader: 3.2,
  interval: 1.234,
  intervalsAt: 1000,
  lastLap: null,
  lastLapTime: null,
  lastLapIsPit: false,
  lastLapIsSessionBest: false,
  lastLapIsPersonalBest: false,
  bestLapTime: null,
  hasSessionBest: false,
  gapToBest: null,
  lastPit: null,
  pits: [],
  inPit: false,
  gone: false,
  blueFlag: false,
  warning: null,
  ...o,
});

describe("columns", () => {
  it("телефон - 4 колонки, desktop гонки з прогнозом", () => {
    expect(columnsFor("mobile", true)).toEqual(["pos", "driver", "gap", "tyre"]);
    expect(columnsFor("mobile", false)).toHaveLength(4);
    expect(columnsFor("desktop", true)).toContain("pred");
    expect(columnsFor("desktop", true, { showPrediction: false })).not.toContain("pred");
    expect(columnsFor("wide", true)).toContain("best");
    expect(columnsFor("desktop", false)).toEqual(expect.arrayContaining(["best", "delta", "s1", "s2", "s3"]));
    expect(columnsFor("desktop", false)).not.toContain("gap");
    expect(columnsFor("unknown", true)).toEqual(columnsFor("desktop", true));
    expect(layoutHasPrediction("tablet", true)).toBe(false);
    expect(layoutHasPrediction("wide", true)).toBe(true);
    expect(layoutHasPrediction("wide", false)).toBe(false);
  });
});

describe("order", () => {
  it("у гонці зійшлі йдуть униз, у кваліфікації - ні", () => {
    const rows = [row({ driverNumber: 1 }), row({ driverNumber: 2, gone: true }), row({ driverNumber: 3 })];
    expect(displayRows(rows, true).map((r) => r.driverNumber)).toEqual([1, 3, 2]);
    expect(displayRows(rows, false)).toBe(rows);
    const clean = [row({ driverNumber: 1 })];
    expect(displayRows(clean, true)).toBe(clean);
  });

  it("набір пілотів і дельти позицій", () => {
    expect(sameMembers([1, 2, 3], [3, 1, 2])).toBe(true);
    expect(sameMembers([1, 2], [1, 3])).toBe(false);
    expect(sameMembers(null, [1])).toBe(false);
    expect(orderDeltas([1, 2, 3], [2, 1, 3])).toEqual({ 2: 1, 1: -1 });
    expect(orderDeltas(null, [1])).toEqual({});
    expect(orderDeltas([1, 2, 3, 4], [4, 1, 2, 3])).toEqual({ 4: 3, 1: -1, 2: -1, 3: -1 });
  });

  it("стрілки накопичуються в одному напрямку і згасають", () => {
    let a = mergeArrows({}, { 5: -1 }, 0);
    expect(a[5]).toEqual({ delta: -1, until: MOTION.arrows });
    a = mergeArrows(a, { 5: -1 }, 1000);
    expect(a[5].delta).toBe(-2);
    a = mergeArrows(a, { 5: 3 }, 2000);
    expect(a[5].delta).toBe(3);
    expect(nextArrowExpiry(a)).toBe(2000 + MOTION.arrows);
    expect(mergeArrows(a, {}, 2000 + MOTION.arrows)).toEqual({});
    expect(nextArrowExpiry({})).toBeNull();
  });

  it("злиття подій і тротлінг reorder на ×5+", () => {
    expect(reorderDelay({ now: 100, pendingSince: 100, lastAppliedAt: null, speed: 1 })).toBe(MOTION.mergeWindow);
    expect(reorderDelay({ now: 300, pendingSince: 100, lastAppliedAt: null, speed: 1 })).toBe(50);
    expect(reorderDelay({ now: 1000, pendingSince: 100, lastAppliedAt: 0, speed: 1 })).toBe(0);
    // ×10: не раніше, ніж через 1 с від попередньої перестановки
    expect(reorderDelay({ now: 200, pendingSince: 200, lastAppliedAt: 100, speed: 10 })).toBe(900);
    expect(reorderDelay({ now: 2000, pendingSince: 2000, lastAppliedAt: 100, speed: 10 })).toBe(MOTION.mergeWindow);
  });
});

describe("gap cells", () => {
  it("інтервал / до лідера / лідер / кола", () => {
    expect(raceGapCell(row(), { mode: "interval", t })).toEqual({ text: "+1.234", kind: "value" });
    expect(raceGapCell(row(), { mode: "leader", t, digits: 1 })).toEqual({ text: "+3.2", kind: "value" });
    expect(raceGapCell(row({ isLeader: true, interval: null, gapToLeader: null }), { mode: "interval", t })).toEqual({ text: "Leader", kind: "leader" });
    expect(raceGapCell(row({ interval: "+1 LAP" }), { mode: "interval", t })).toEqual({ text: "+1 lap", kind: "laps" });
    expect(raceGapCell(row({ interval: null }), { mode: "interval", t }).text).toBe("—");
    expect(raceGapCell(row({ gapToLeader: 75.04 }), { mode: "leader", t }).text).toBe("+1:15.0");
  });

  it("до вибраного: знак, опора, лідер як опора, кола → —", () => {
    const ref = row({ driverNumber: 9, gapToLeader: 5 });
    expect(raceGapCell(row({ gapToLeader: 3.2 }), { mode: "focus", refRow: ref, t }).text).toBe("−1.800");
    expect(raceGapCell(row({ gapToLeader: 6.5 }), { mode: "focus", refRow: ref, t }).text).toBe("+1.500");
    expect(raceGapCell(ref, { mode: "focus", refRow: ref, t })).toEqual({ text: "Ref", kind: "ref" });
    const leader = row({ driverNumber: 7, isLeader: true, gapToLeader: null });
    expect(raceGapCell(row({ gapToLeader: 2 }), { mode: "focus", refRow: leader, t }).text).toBe("+2.000");
    expect(raceGapCell(leader, { mode: "focus", refRow: ref, t }).text).toBe("−5.000");
    expect(raceGapCell(row({ gapToLeader: "+1 LAP" }), { mode: "focus", refRow: ref, t }).kind).toBe("none");
    expect(raceGapCell(row(), { mode: "focus", refRow: null, t }).kind).toBe("none");
  });

  it("кваліфікація: Δ і компактна колонка", () => {
    expect(qualiDeltaCell(row({ gapToBest: 0.4567 }), { t }).text).toBe("+0.457");
    expect(qualiDeltaCell(row({ isLeader: true, gapToBest: 0 }), { t }).kind).toBe("leader");
    expect(qualiDeltaCell(row({ gapToBest: null }), { t }).text).toBe("—");
    expect(qualiCompactCell(row({ isLeader: true, bestLapTime: 70.123 }), { t })).toEqual({ text: "1:10.123", kind: "best" });
    expect(qualiCompactCell(row({ isLeader: true }), { t }).kind).toBe("leader");
    expect(qualiCompactCell(row({ gapToBest: 1.2 }), { t, digits: 1 }).text).toBe("+1.2");
  });
});

describe("timing colours", () => {
  it("останнє / найкраще коло", () => {
    expect(lastLapKind(row())).toBe("none");
    expect(lastLapKind(row({ lastLapTime: 80, lastLapIsPit: true, lastLapIsSessionBest: true }))).toBe("pit");
    expect(lastLapKind(row({ lastLapTime: 80, lastLapIsSessionBest: true, lastLapIsPersonalBest: true }))).toBe("session");
    expect(lastLapKind(row({ lastLapTime: 80, lastLapIsPersonalBest: true }))).toBe("personal");
    expect(lastLapKind(row({ lastLapTime: 80 }))).toBe("normal");
    expect(bestLapKind(row({ bestLapTime: 70, hasSessionBest: true }))).toBe("session");
    expect(bestLapKind(row({ bestLapTime: 70 }))).toBe("normal");
    expect(bestLapKind(row())).toBe("none");
  });

  it("сектори", () => {
    const best = [{ time: 20 }, null, { time: 30 }];
    const pb = [21, 25, 31];
    expect(sectorKind(20, 0, best, pb)).toBe("session");
    expect(sectorKind(21, 0, best, pb)).toBe("personal");
    expect(sectorKind(25, 1, best, pb)).toBe("personal");
    expect(sectorKind(32, 2, best, pb)).toBe("normal");
    expect(sectorKind(null, 0, best, pb)).toBe("none");
    expect(sectorKind(22, 0, null, null)).toBe("normal");
  });
});

describe("chips", () => {
  it("коло виїзду: після pit і до наступного завершеного кола", () => {
    const lastLap = { lap_number: 25, t: 1000 };
    expect(isOutLap(row({ lastLap, lastPit: { t: 1500 } }))).toBe(true);
    expect(isOutLap(row({ lastLap, lastPit: { t: 1500 }, inPit: true }))).toBe(false);
    expect(isOutLap(row({ lastLap: { lap_number: 26, t: 2000 }, lastPit: { t: 1500 } }))).toBe(false);
    expect(isOutLap(row({ lastLap: null, lastPit: { t: 1500 } }))).toBe(true);
    expect(isOutLap(row({ lastLap, lastPit: null }))).toBe(false);
  });

  it("порядок і правила чіпів", () => {
    expect(rowChips(row({ inPit: true, blueFlag: true }), { isRace: true }).map((c) => c.key)).toEqual(["pit", "blue"]);
    expect(rowChips(row({ gone: true, blueFlag: true, inPit: true }), { isRace: true }).map((c) => c.key)).toEqual(["ret"]);
    expect(rowChips(row({ gone: true }), { isRace: false }).map((c) => c.key)).toEqual(["garage"]);
    const warn = rowChips(row({ warning: { message: "CAR 1 TRACK LIMITS" } }), { isRace: true });
    expect(warn).toEqual([{ key: "warn", message: "CAR 1 TRACK LIMITS" }]);
    expect(rowChips(row({ lastLap: { t: 1 }, lastPit: { t: 2 } }), { isRace: true })[0].key).toBe("out");
    expect(rowChips(row(), { isRace: true })).toEqual([]);
  });

  it("застарілі інтервали > 15 с", () => {
    expect(intervalsStale(row({ intervalsAt: 0 }), 15001)).toBe(true);
    expect(intervalsStale(row({ intervalsAt: 0 }), 15000)).toBe(false);
    expect(intervalsStale(row({ intervalsAt: null }), 99999)).toBe(false);
    expect(intervalsStale(row(), null)).toBe(false);
  });

  it("підсумок пітів", () => {
    expect(pitSummary([{ lap_number: 25, lane_duration: 22.31, stop_duration: null }, { lap_number: 40, pit_duration: 21 }])).toEqual([
      { lap: 25, lane: 22.31, stop: null },
      { lap: 40, lane: 21, stop: null },
    ]);
    expect(pitSummary(null)).toEqual([]);
  });
});

describe("qualifying", () => {
  it("частина й зона вибування", () => {
    expect(latestQualifyingPhase([{ qualifying_phase: null }, { qualifying_phase: 2 }, { qualifying_phase: 1 }])).toBe(2);
    expect(latestQualifyingPhase([])).toBeNull();
    expect(eliminationRange(1, 22)).toEqual([17, 22]);
    expect(eliminationRange(2, 22)).toEqual([11, 16]);
    expect(eliminationRange(2, 20)).toEqual([11, 15]);
    expect(eliminationRange(3, 22)).toBeNull();
    expect(eliminationRange(1, 19)).toBeNull();
    expect(inRange(17, [17, 22])).toBe(true);
    expect(inRange(16, [17, 22])).toBe(false);
    expect(inRange(null, [17, 22])).toBe(false);
    expect(isQualifyingSession({ session_type: "Qualifying", session_name: "Qualifying" })).toBe(true);
    expect(isQualifyingSession({ session_type: "Qualifying", session_name: "Sprint Qualifying" })).toBe(true);
    expect(isQualifyingSession({ session_type: "Practice", session_name: "Practice 1" })).toBe(false);
  });
});

describe("prediction & a11y", () => {
  it("клітинка прогнозу", () => {
    expect(predictionCell({ predicted_position: 5 }, 3)).toEqual({ predicted: 5, delta: 2 });
    expect(predictionCell({ predicted_position: 2 }, 4)).toEqual({ predicted: 2, delta: -2 });
    expect(predictionCell({ predicted_position: 2 }, null)).toEqual({ predicted: 2, delta: null });
    expect(predictionCell(undefined, 1)).toBeNull();
  });

  it("оголошення позиції", () => {
    expect(positionAnnouncement("Lando NORRIS", 3, 2, t)).toBe('live.tower.a11y.gained:{"name":"Lando NORRIS","position":2}');
    expect(positionAnnouncement("X", 2, 4, t)).toContain("a11y.lost");
    expect(positionAnnouncement("X", 2, 2, t)).toBeNull();
    expect(positionAnnouncement("X", null, 2, t)).toBeNull();
  });
});

describe("status bar", () => {
  it("свіжість", () => {
    expect(freshnessState({ status: "playing", clock: 20000, lastEventAt: 15000 })).toBe("fresh");
    expect(freshnessState({ status: "playing", clock: 30000, lastEventAt: 15000 })).toBe("nodata");
    expect(freshnessState({ status: "buffering", clock: 30000, lastEventAt: 29000 })).toBe("buffering");
    expect(freshnessState({ status: "paused", paused: true, clock: 99999, lastEventAt: 0 })).toBe("paused");
    expect(freshnessState({ status: "loading" })).toBe("connecting");
    expect(freshnessState({ status: "lost" })).toBe("lost");
    expect(freshnessState({ status: "ended" })).toBe("ended");
  });

  it("назви сесій і чіп траси", () => {
    expect(sessionNameKey("Race")).toBe("race");
    expect(sessionNameKey("Sprint Shootout")).toBe("sprintQualifying");
    expect(sessionNameKey("Practice 2")).toBe("practice2");
    expect(sessionNameKey("Something")).toBeNull();
    expect(trackChip({ state: "CHEQUERED" }, 0)).toBe("chequered");
    expect(trackChip({ state: "CLEAR", clearedAt: 1000 }, 3000)).toBe("green");
    expect(trackChip({ state: "CLEAR", clearedAt: 1000 }, 7000)).toBeNull();
    expect(trackChip({ state: "SC" }, 0)).toBeNull();
    expect(trackChip(null, 0)).toBeNull();
  });
});

describe("banner", () => {
  it("види банера", () => {
    expect(describeBanner(null)).toBeNull();
    expect(describeBanner({ kind: "RED", sectors: [] }).tone).toBe("red");
    expect(describeBanner({ kind: "SC", phase: "DEPLOYED", sectors: [] })).toMatchObject({ tone: "sc", abbr: "SC", textKey: "scDeployed" });
    expect(describeBanner({ kind: "VSC", phase: "ENDING", sectors: [] })).toMatchObject({ tone: "vsc", abbr: "VSC", textKey: "vscEnding" });
    expect(describeBanner({ kind: "SC", phase: null, message: "SAFETY CAR THROUGH THE PIT LANE", sectors: [] })).toMatchObject({
      textKey: null,
      raw: "SAFETY CAR THROUGH THE PIT LANE",
    });
    const sec = describeBanner({ kind: "SECTOR_DOUBLE_YELLOW", sectors: [{ sector: 3, flag: "YELLOW" }, { sector: 4, flag: "DOUBLE YELLOW" }] });
    expect(sec).toMatchObject({ tone: "yellow", textKey: "sectorDoubleYellow", double: true });
    expect(sec.sectors).toEqual([
      { sector: 3, double: false },
      { sector: 4, double: true },
    ]);
  });
});
