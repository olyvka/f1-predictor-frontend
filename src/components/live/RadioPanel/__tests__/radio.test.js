import { describe, it, expect } from "vitest";
import { matchesRadioFilter, lapAt, unheardCount } from "../radio";

const clip = (n, url) => ({ driver_number: n, recording_url: url });

describe("radio helpers", () => {
  it("фільтри: усі, пілот у фокусі, непрослухані", () => {
    const heard = { a: true };
    expect(matchesRadioFilter(clip(44, "a"), "all", { focus: null, heard })).toBe(true);
    expect(matchesRadioFilter(clip(44, "a"), "focus", { focus: 44, heard })).toBe(true);
    expect(matchesRadioFilter(clip(1, "b"), "focus", { focus: 44, heard })).toBe(false);
    expect(matchesRadioFilter(clip(1, "b"), "focus", { focus: null, heard })).toBe(false);
    expect(matchesRadioFilter(clip(44, "a"), "unheard", { focus: null, heard })).toBe(false);
    expect(matchesRadioFilter(clip(1, "b"), "unheard", { focus: null, heard })).toBe(true);
  });

  it("коло в момент кліпу", () => {
    const laps = { 44: [
      { lap_number: 13, date_start: "2026-11-08T17:21:17Z" },
      { lap_number: 14, date_start: "2026-11-08T17:22:47Z" },
    ] };
    expect(lapAt(laps, 44, Date.parse("2026-11-08T17:23:00Z"))).toBe(14);
    expect(lapAt(laps, 44, Date.parse("2026-11-08T17:22:00Z"))).toBe(13);
    expect(lapAt(laps, 44, Date.parse("2026-11-08T17:00:00Z"))).toBeNull();
    expect(lapAt(laps, 1, Date.parse("2026-11-08T17:23:00Z"))).toBeNull();
  });

  it("лічильник непрослуханих", () => {
    expect(unheardCount([clip(1, "a"), clip(1, "b"), clip(4, "c")], { b: true })).toBe(2);
  });
});
