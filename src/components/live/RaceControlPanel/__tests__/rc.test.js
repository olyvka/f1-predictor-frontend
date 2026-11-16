import { describe, it, expect } from "vitest";
import { parseGmtOffset, trackClock, formatTrackClock, matchesFilter, countByFilter, flagMeta, messageKeys, mentionsDriver, newPits, isNewFastest } from "../rc";

const T = Date.parse("2026-11-08T17:03:17Z");

describe("gmt_offset і місцевий час траси", () => {
  it("розбирає формати OpenF1", () => {
    expect(parseGmtOffset("-03:00:00")).toBe(-180);
    expect(parseGmtOffset("05:30:00")).toBe(330);
    expect(parseGmtOffset("+01:00")).toBe(60);
    expect(parseGmtOffset("00:00:00")).toBe(0);
    expect(parseGmtOffset(null)).toBeNull();
    expect(parseGmtOffset("")).toBeNull();
    expect(parseGmtOffset("abc")).toBeNull();
    expect(parseGmtOffset("25:00:00")).toBeNull();
    expect(parseGmtOffset(-10800)).toBe(-180);
  });
  it("збігається з TIMED AT у повідомленні FIA", () => {
    expect(trackClock(T, "-03:00:00")).toEqual({ text: "14:03:17", utc: false });
    expect(formatTrackClock(T, "-03:00:00")).toBe("14:03:17");
  });
  it("переходить через північ", () => {
    expect(trackClock(Date.parse("2026-03-01T01:30:00Z"), "-03:00:00").text).toBe("22:30:00");
    expect(trackClock(Date.parse("2026-03-01T22:30:00Z"), "09:00:00").text).toBe("07:30:00");
  });
  it("без gmt_offset - UTC із суфіксом", () => {
    expect(trackClock(T, undefined)).toEqual({ text: "17:03:17", utc: true });
    expect(formatTrackClock(T)).toBe("17:03:17 UTC");
    expect(formatTrackClock(null, "-03:00:00")).toBe("—");
  });
});

const msgs = [
  { category: "Flag", flag: "YELLOW", scope: "Sector", sector: 4, message: "YELLOW IN TRACK SECTOR 4" },
  { category: "SafetyCar", message: "SAFETY CAR DEPLOYED" },
  { category: "Other", message: "CAR 44 (HAM) TIME 1:12.345 DELETED - TRACK LIMITS AT TURN 4" },
  { category: "Flag", flag: "BLACK AND WHITE", driver_number: 1, message: "BLACK AND WHITE FLAG FOR CAR 1 (VER)" },
  { category: "Other", message: "DRS ENABLED" },
  { category: "Flag", flag: "BLUE", driver_number: 23, message: "WAVED BLUE FLAG FOR CAR 23 (ALB)" },
];

describe("фільтри", () => {
  it("розкладає за категоріями", () => {
    expect(msgs.filter((m) => matchesFilter(m, "flag")).length).toBe(2);
    expect(msgs.filter((m) => matchesFilter(m, "sc")).length).toBe(1);
    expect(msgs.filter((m) => matchesFilter(m, "penalty")).length).toBe(2);
    expect(msgs.filter((m) => matchesFilter(m, "other")).length).toBe(1);
    expect(msgs.filter((m) => matchesFilter(m, "all")).length).toBe(6);
    expect(countByFilter(msgs)).toEqual({ all: 6, flag: 2, sc: 1, penalty: 2, other: 1 });
  });
});

describe("чіп прапора", () => {
  it("SC / VSC / прапори / сесія / невідомий", () => {
    expect(flagMeta({ category: "SafetyCar", message: "VIRTUAL SAFETY CAR DEPLOYED" }).kind).toBe("vsc");
    expect(flagMeta({ category: "SafetyCar", message: "SAFETY CAR IN THIS LAP" }).kind).toBe("sc");
    expect(flagMeta({ flag: "DOUBLE YELLOW" }).kind).toBe("double-yellow");
    expect(flagMeta({ flag: "CHEQUERED" }).kind).toBe("chequered");
    expect(flagMeta({ flag: "BLACK AND WHITE" }).kind).toBe("bw");
    expect(flagMeta({ category: "SessionStatus" }).kind).toBe("session");
    expect(flagMeta({ flag: "PURPLE" })).toEqual({ kind: "raw", raw: "PURPLE" });
    expect(flagMeta({ category: "Other" }).kind).toBe("other");
  });
});

describe("ключі та пілоти", () => {
  it("повтори отримують суфікс", () => {
    const m = { t: 1, message: "X" };
    expect(messageKeys([m, { ...m }, { t: 2, message: "X" }])).toEqual(["1||X", "1||X#1", "2||X"]);
  });
  it("пілот за driver_number або згадкою в тексті", () => {
    expect(mentionsDriver(msgs[3], 1)).toBe(true);
    expect(mentionsDriver(msgs[2], 44)).toBe(true);
    expect(mentionsDriver(msgs[2], 1)).toBe(false);
    expect(mentionsDriver({ message: "CARS 12 (ANT) AND 1 (VER) NOTED" }, 12)).toBe(true);
    expect(mentionsDriver(msgs[0], null)).toBe(false);
  });
});

describe("тости", () => {
  it("нові піт-стопи між знімками", () => {
    const a = { 4: [{ date: "d1", lap_number: 10, t: 1 }] };
    const b = { ...a, 4: [...a[4], { date: "d2", lap_number: 30, t: 3 }], 16: [{ date: "d3", lap_number: 29, t: 2 }] };
    expect(newPits(a, b).map((x) => [x.driverNumber, x.pit.lap_number])).toEqual([[16, 29], [4, 30]]);
    expect(newPits(null, b)).toEqual([]);
    expect(newPits(b, b)).toEqual([]);
  });
  it("нове найшвидше коло лише при покращенні", () => {
    expect(isNewFastest({ time: 72 }, { time: 71.9 })).toBe(true);
    expect(isNewFastest({ time: 72 }, { time: 72 })).toBe(false);
    expect(isNewFastest(null, { time: 72 })).toBe(false);
  });
});
