import { describe, it, expect } from "vitest";
import { deriveTrackStatus, reduceTrackStatus, initialTrackStatus, bannerFor, rcFilterKind } from "../trackStatus";

const rc = (date, category, flag, scope, message, extra = {}) => ({
  date: `2025-07-06T14:${date}+00:00`,
  category,
  flag,
  scope,
  sector: null,
  message,
  lap_number: 3,
  ...extra,
});

describe("trackStatus", () => {
  it("SC: deployed → in this lap → track clear", () => {
    let s = deriveTrackStatus([rc("00:00", "SafetyCar", null, null, "SAFETY CAR DEPLOYED")]);
    expect(s.state).toBe("SC");
    expect(s.phase).toBe("DEPLOYED");
    expect(bannerFor(s).kind).toBe("SC");
    s = reduceTrackStatus(s, rc("03:00", "SafetyCar", null, null, "SAFETY CAR IN THIS LAP"));
    expect(s.phase).toBe("ENDING");
    s = reduceTrackStatus(s, rc("04:00", "Flag", "CLEAR", "Track", "TRACK CLEAR"));
    expect(s.state).toBe("CLEAR");
    expect(s.clearedAt).toBe(Date.parse("2025-07-06T14:04:00Z"));
    expect(bannerFor(s)).toBeNull();
  });

  it("VSC і невідомий текст SafetyCar", () => {
    const s = deriveTrackStatus([rc("00:00", "SafetyCar", null, null, "VIRTUAL SAFETY CAR DEPLOYED")]);
    expect(s.state).toBe("VSC");
    expect(reduceTrackStatus(s, rc("01:00", "SafetyCar", null, null, "VIRTUAL SAFETY CAR ENDING")).phase).toBe("ENDING");
    const odd = reduceTrackStatus(s, rc("02:00", "SafetyCar", null, null, "SAFETY CAR THROUGH THE PIT LANE"));
    expect(odd.state).toBe("SC");
    expect(odd.phase).toBeNull();
    expect(odd.message).toBe("SAFETY CAR THROUGH THE PIT LANE");
  });

  it("червоний прапор не знімається TRACK CLEAR, лише GREEN / SESSION STARTED", () => {
    let s = deriveTrackStatus([rc("00:00", "Flag", "RED", "Track", "RED FLAG"), rc("01:00", "Flag", "CLEAR", "Track", "TRACK CLEAR")]);
    expect(s.state).toBe("RED");
    s = reduceTrackStatus(s, rc("02:00", "SessionStatus", null, null, "SESSION STARTED"));
    expect(s.state).toBe("CLEAR");
    s = reduceTrackStatus(s, rc("03:00", "Flag", "RED", "Track", "RED FLAG"));
    s = reduceTrackStatus(s, rc("04:00", "Flag", "GREEN", "Track", "GREEN LIGHT - PIT EXIT OPEN"));
    expect(s.state).toBe("CLEAR");
  });

  it("жовті сектори: додаються, знімаються CLEAR, скидаються зеленим", () => {
    let s = deriveTrackStatus([
      rc("00:00", "Flag", "DOUBLE YELLOW", "Sector", "DOUBLE YELLOW IN TRACK SECTOR 6", { sector: 6 }),
      rc("00:05", "Flag", "YELLOW", "Sector", "YELLOW IN TRACK SECTOR 5", { sector: 5 }),
      rc("00:10", "Flag", "YELLOW", "Sector", "YELLOW IN TRACK SECTOR 6", { sector: 6 }),
    ]);
    expect(s.sectors.map((x) => [x.sector, x.flag])).toEqual([
      [5, "YELLOW"],
      [6, "YELLOW"],
    ]);
    expect(bannerFor(s).kind).toBe("SECTOR_YELLOW");
    s = reduceTrackStatus(s, rc("01:00", "Flag", "CLEAR", "Sector", "CLEAR IN TRACK SECTOR 5", { sector: 5 }));
    expect(s.sectors.map((x) => x.sector)).toEqual([6]);
    s = reduceTrackStatus(s, rc("01:10", "Flag", "DOUBLE YELLOW", "Sector", "", { sector: 2 }));
    expect(bannerFor(s).kind).toBe("SECTOR_DOUBLE_YELLOW");
    s = reduceTrackStatus(s, rc("02:00", "Flag", "GREEN", "Track", "GREEN LIGHT"));
    expect(s.sectors).toEqual([]);
  });

  it("CHEQUERED, нерелевантні повідомлення, фільтри", () => {
    const s0 = initialTrackStatus();
    expect(reduceTrackStatus(s0, rc("00:00", "Other", null, null, "LOW GRIP CONDITIONS"))).toBe(s0);
    expect(reduceTrackStatus(s0, rc("00:00", "Flag", "BLUE", "Driver", "WAVED BLUE FLAG", { driver_number: 1 }))).toBe(s0);
    expect(deriveTrackStatus([rc("00:00", "Flag", "CHEQUERED", "Track", "CHEQUERED FLAG")]).state).toBe("CHEQUERED");
    expect(rcFilterKind({ category: "SafetyCar", message: "SAFETY CAR DEPLOYED" })).toBe("sc");
    expect(rcFilterKind({ category: "Other", message: "CAR 1 (NOR) TIME 1:12.345 DELETED - TRACK LIMITS" })).toBe("penalty");
    expect(rcFilterKind({ category: "Flag", flag: "YELLOW", message: "YELLOW IN TRACK SECTOR 1" })).toBe("flag");
    expect(rcFilterKind({ category: "Other", message: "WET TRACK" })).toBe("other");
  });
});
