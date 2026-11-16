import { describe, it, expect } from "vitest";
import { windArrowRotation, compassPoint, isWeatherStale, isRaining, pushSample, trendDelta, trendDirection } from "../weather";

const MIN = 60000;

describe("вітер", () => {
  it("стрілка куди дме = звідки + 180°", () => {
    expect(windArrowRotation(0)).toBe(180);
    expect(windArrowRotation(179)).toBe(359);
    expect(windArrowRotation(270)).toBe(90);
    expect(windArrowRotation(null)).toBeNull();
  });
  it("румб", () => {
    expect(compassPoint(0)).toBe("N");
    expect(compassPoint(179)).toBe("S");
    expect(compassPoint(350)).toBe("N");
    expect(compassPoint(225)).toBe("SW");
    expect(compassPoint(undefined)).toBeNull();
  });
});

describe("стан", () => {
  it("застаріло > 3 хв часу сесії", () => {
    expect(isWeatherStale({ t: 0 }, 3 * MIN)).toBe(false);
    expect(isWeatherStale({ t: 0 }, 3 * MIN + 1)).toBe(true);
    expect(isWeatherStale(null, 10 * MIN)).toBe(false);
    expect(isWeatherStale({ t: 0 }, null)).toBe(false);
  });
  it("дощ", () => {
    expect(isRaining({ rainfall: 1 })).toBe(true);
    expect(isRaining({ rainfall: 0 })).toBe(false);
    expect(isRaining({ rainfall: null })).toBeNull();
    expect(isRaining(null)).toBeNull();
  });
});

describe("тренд траси", () => {
  it("Δ за 10 хв і поріг", () => {
    let h = [];
    for (let m = 0; m <= 12; m++) h = pushSample(h, m * MIN, 30 + m * 0.2);
    expect(trendDelta(h)).toBeCloseTo(2.0, 5);
    expect(trendDirection(trendDelta(h))).toBe("up");
    expect(trendDirection(-0.7)).toBe("down");
    expect(trendDirection(0.3)).toBeNull();
  });
  it("замало історії → null", () => {
    let h = pushSample([], 0, 30);
    h = pushSample(h, 5 * MIN, 32);
    expect(trendDelta(h)).toBeNull();
  });
  it("перемотування назад скидає історію, повтор не дублюється", () => {
    let h = pushSample([], 10 * MIN, 30);
    expect(pushSample(h, 10 * MIN, 30)).toBe(h);
    h = pushSample(h, 2 * MIN, 31);
    expect(h).toEqual([{ t: 2 * MIN, v: 31 }]);
  });
  it("обрізає старше 15 хв", () => {
    let h = [];
    for (let m = 0; m <= 30; m++) h = pushSample(h, m * MIN, 30);
    expect(h[0].t).toBe(15 * MIN);
  });
});
