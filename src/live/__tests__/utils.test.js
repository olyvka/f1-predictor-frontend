import { describe, it, expect } from "vitest";
import { parseTime } from "../time";
import { formatLapTime, formatSectorTime, formatGap, parseGap, formatDelta, gapBetween, formatClock, formatInt, DASH } from "../format";
import { tyreAge, isUsedSet, currentStint, compoundMeta } from "../tyres";
import { normalizeHex, contrastRatio, fixContrast, textOn, FALLBACK_TEAM_COLOR } from "../color";
import { normalizeName, matchPredictions, spearman, ranks, modelVsRace } from "../predictions";
import { TimeRing } from "../ringBuffer";
import { toWsBase, buildReplayUrl, buildLiveUrl, roundOffset } from "../sources/url";

describe("time", () => {
  it("розбирає ISO з мікросекундами", () => {
    expect(parseTime("2026-11-08T17:22:01.257849+00:00")).toBe(Date.UTC(2026, 10, 8, 17, 22, 1, 257));
    expect(parseTime("2026-11-08T17:22:00+00:00")).toBe(Date.UTC(2026, 10, 8, 17, 22, 0));
    expect(parseTime(null)).toBeNull();
    expect(parseTime("не дата")).toBeNull();
  });
});

describe("format", () => {
  it("час кола", () => {
    expect(formatLapTime(72.456)).toBe("1:12.456");
    expect(formatLapTime(60)).toBe("1:00.000");
    expect(formatLapTime(119.9996)).toBe("2:00.000");
    expect(formatLapTime(59.1234)).toBe("59.123");
    expect(formatLapTime(null)).toBe(DASH);
    expect(formatLapTime(NaN)).toBe(DASH);
    expect(formatSectorTime(23.4561)).toBe("23.456");
    expect(formatSectorTime(undefined)).toBe(DASH);
  });

  it("відставання: числа, ≥60 с, рядки LAP, null", () => {
    expect(formatGap(1.2345)).toBe("+1.234");
    expect(formatGap(0)).toBe("+0.000");
    expect(formatGap(1.25, { digits: 1 })).toBe("+1.3");
    expect(formatGap(62.3)).toBe("+1:02.3");
    expect(formatGap(60)).toBe("+1:00.0");
    expect(formatGap(119.97)).toBe("+2:00.0");
    expect(formatGap(null)).toBe(DASH);
    expect(formatGap("+1 LAP")).toBe("+1 LAP");
    expect(formatGap("+3 LAPS")).toBe("+3 LAPS");
    const t = (key, { count }) => `${key}:${count}`;
    expect(formatGap("+1 LAP", { t })).toBe("live.common.lapsDown:1");
    expect(formatGap("+2 LAPS", { t })).toBe("live.common.lapsDown:2");
    expect(formatGap("щось інше")).toBe("щось інше");
  });

  it("parseGap і різниця відставань", () => {
    expect(parseGap("+2 LAPS")).toEqual({ kind: "laps", laps: 2 });
    expect(parseGap(3.5)).toEqual({ kind: "time", seconds: 3.5 });
    expect(parseGap("4.5")).toEqual({ kind: "time", seconds: 4.5 });
    expect(parseGap(undefined)).toEqual({ kind: "none" });
    expect(gapBetween(5.5, 2)).toBeCloseTo(3.5);
    expect(gapBetween("+1 LAP", 2)).toBeNull();
    expect(gapBetween(null, 2)).toBeNull();
  });

  it("дельта, годинник, цілі", () => {
    expect(formatDelta(0.1234)).toBe("+0.123");
    expect(formatDelta(-0.5)).toBe("−0.500");
    expect(formatDelta(0.0001)).toBe("±0.000");
    expect(formatDelta(null)).toBe(DASH);
    expect(formatClock(3737)).toBe("1:02:17");
    expect(formatClock(137)).toBe("02:17");
    expect(formatClock(137, { hours: true })).toBe("0:02:17");
    expect(formatClock(-300)).toBe("−05:00");
    expect(formatClock(null)).toBe(DASH);
    expect(formatInt(287.6)).toBe("288");
    expect(formatInt(null)).toBe(DASH);
  });
});

describe("tyres", () => {
  const stint = { stint_number: 2, compound: "HARD", lap_start: 20, tyre_age_at_start: 3 };
  it("вік комплекту", () => {
    expect(tyreAge(stint, 19)).toBe(3); // ще на out-lap
    expect(tyreAge(stint, 20)).toBe(4);
    expect(tyreAge(stint, 34)).toBe(18);
    expect(tyreAge({ ...stint, tyre_age_at_start: null }, 25)).toBe(6);
    expect(tyreAge(stint, null)).toBe(3);
    expect(tyreAge(null, 10)).toBeNull();
  });
  it("вживаний комплект, поточний стінт, метадані", () => {
    expect(isUsedSet(stint)).toBe(true);
    expect(isUsedSet({ ...stint, tyre_age_at_start: 0 })).toBe(false);
    expect(currentStint([{ stint_number: 1 }, { stint_number: 3 }, { stint_number: 2 }]).stint_number).toBe(3);
    expect(currentStint([])).toBeNull();
    expect(compoundMeta("soft").letter).toBe("S");
    expect(compoundMeta("INTERMEDIATE").letter).toBe("I");
    expect(compoundMeta(null).letter).toBe("?");
    expect(compoundMeta("UNKNOWN").key).toBe("unknown");
  });
});

describe("color", () => {
  it("нормалізує hex", () => {
    expect(normalizeHex("f47600")).toBe("#F47600");
    expect(normalizeHex("#abc")).toBe("#AABBCC");
    expect(normalizeHex("")).toBeNull();
    expect(normalizeHex(null)).toBeNull();
  });
  it("піднімає контраст темних кольорів до ≥ 3:1 і не чіпає світлі", () => {
    const bg = "#111318";
    const dark = fixContrast("1E2A78", bg);
    expect(contrastRatio(dark, bg)).toBeGreaterThanOrEqual(3);
    expect(fixContrast("F47600", bg)).toBe("#F47600");
    expect(fixContrast(null, bg)).toBe(FALLBACK_TEAM_COLOR);
    // світлий фон - темнимо
    expect(contrastRatio(fixContrast("FFE066", "#FFFFFF"), "#FFFFFF")).toBeGreaterThanOrEqual(3);
  });
  it("текст на плашці", () => {
    expect(textOn("#FFFFFF")).toBe("#000000");
    expect(textOn("#1E2A78")).toBe("#FFFFFF");
  });
});

describe("predictions", () => {
  const drivers = [
    { driver_number: 12, name_acronym: "ANT", full_name: "Kimi ANTONELLI" },
    { driver_number: 44, name_acronym: "HAM", full_name: "Lewis HAMILTON" },
    { driver_number: 41, name_acronym: "LIN", full_name: "Arvid LINDBLAD" },
    { driver_number: 27, name_acronym: "HUL", full_name: "Nico HÜLKENBERG" },
  ];
  const standings = [
    { driver_id: 863, code: "ANT" },
    { driver_id: 1, code: "HAM" },
  ];
  it("зіставляє за кодом, потім за ім'ям і прізвищем", () => {
    const preds = [
      { driver_id: 863, driver: "Andrea Kimi Antonelli", predicted_position: 1 },
      { driver_id: 1, driver: "Lewis Hamilton", predicted_position: 2 },
      { driver_id: 999, driver: "Arvid Lindblad", predicted_position: 3 }, // дебютант без standings
      { driver_id: 998, driver: "Nico Hulkenberg", predicted_position: 4 }, // діакритика
      { driver_id: 997, driver: "Невідомий Пілот", predicted_position: 5 },
    ];
    const { byNumber, unmatched } = matchPredictions(preds, standings, drivers);
    expect(byNumber[12].predicted_position).toBe(1);
    expect(byNumber[44].predicted_position).toBe(2);
    expect(byNumber[41].predicted_position).toBe(3);
    expect(byNumber[27].predicted_position).toBe(4);
    expect(unmatched.map((p) => p.predicted_position)).toEqual([5]);
    expect(normalizeName("  Nico HÜLKENBERG ")).toBe("nico hulkenberg");
  });
  it("Спірмен і ранги", () => {
    expect(ranks([10, 20, 20, 30])).toEqual([1, 2.5, 2.5, 4]);
    expect(spearman([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1);
    expect(spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])).toBeCloseTo(0.8);
    expect(spearman([1], [1])).toBeNull();
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull();
  });
  it("плитка «Модель зараз»", () => {
    const r = modelVsRace([
      { predicted: 1, position: 2 },
      { predicted: 2, position: 1 },
      { predicted: 3, position: 3 },
      { predicted: 4, position: 5 },
      { predicted: 5, position: 4 },
      { predicted: 6, position: null },
    ]);
    expect(r.n).toBe(5);
    expect(r.podium).toBe(3);
    expect(r.exact).toBe(1);
    expect(r.rho).toBeCloseTo(0.8);
    expect(modelVsRace([]).rho).toBeNull();
  });
});

describe("TimeRing", () => {
  it("кільце з лімітом і інтерполяцією", () => {
    const r = new TimeRing(4);
    for (let i = 0; i < 6; i++) r.push(i * 1000, i * 10, 0);
    expect(r.size).toBe(4);
    expect(r.firstT()).toBe(2000);
    expect(r.lastT()).toBe(5000);
    expect(r.push(4000, 0, 0)).toBe(false); // поза порядком
    const o = r.sample(2500, {});
    expect(o.ok).toBe(true);
    expect(o.x).toBeCloseTo(25);
    expect(r.sample(1000, {}).ok).toBe(false);
    const last = r.sample(7000, {});
    expect(last.x).toBe(50);
    expect(last.age).toBeCloseTo(2);
    const pts = [];
    r.forEachSince(3500, (t) => pts.push(t));
    expect(pts).toEqual([4000, 5000]);
  });
  it("не інтерполює через пропуск > 2 с", () => {
    const r = new TimeRing(8);
    r.push(0, 0, 0);
    r.push(5000, 100, 0);
    const o = r.sample(2500, {});
    expect(o.gap).toBe(true);
    expect(o.x).toBe(0);
  });
});

describe("url", () => {
  it("http→ws, https→wss", () => {
    expect(toWsBase("http://localhost:8000/")).toBe("ws://localhost:8000");
    expect(toWsBase("https://api.example.com")).toBe("wss://api.example.com");
    expect(toWsBase("wss://x.y")).toBe("wss://x.y");
  });
  it("будує адресу replay і live", () => {
    expect(buildReplayUrl({ apiUrl: "https://api.example.com", year: 2026, round: 20, session: "R", speed: 5, offset: 1320.04, lang: "en" })).toBe(
      "wss://api.example.com/ws/replay/2026/20/R?speed=5&offset=1320&lang=en"
    );
    expect(buildReplayUrl({ apiUrl: "http://localhost:8000", year: 2026, round: 20, session: "Q" })).toBe(
      "ws://localhost:8000/ws/replay/2026/20/Q?speed=1&offset=0&lang=uk"
    );
    expect(buildLiveUrl({ apiUrl: "https://a.b", lang: "uk" })).toBe("wss://a.b/ws/live?lang=uk");
    expect(roundOffset(-0.01)).toBe(0);
    expect(roundOffset(12.345)).toBe(12.3);
  });
});

import { formatCountdown } from "../format";
describe("formatCountdown", () => {
  it("хвилини, години, дні", () => {
    expect(formatCountdown(125)).toBe("2:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
    expect(formatCountdown(90061, "d")).toBe("1 d 01:01:01");
    expect(formatCountdown(-1)).toBe("—");
  });
});
