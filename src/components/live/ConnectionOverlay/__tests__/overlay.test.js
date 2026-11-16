import { describe, it, expect } from "vitest";
import { overlayView, staleSeconds, finalClassification } from "../overlay";

describe("який оверлей", () => {
  it("пріоритети станів", () => {
    expect(overlayView({ status: "connecting", ready: false })).toBe("loading");
    expect(overlayView({ status: "loading", ready: false })).toBe("loading");
    expect(overlayView({ status: "loading", ready: false, cancelled: true })).toBe("cancelled");
    expect(overlayView({ status: "error", ready: true })).toBe("error");
    expect(overlayView({ status: "lost", ready: false })).toBe("lost");
    expect(overlayView({ status: "connecting", ready: true, seeking: { offset: 10 } })).toBe("seeking");
    expect(overlayView({ status: "ended", ready: true })).toBe("ended");
    expect(overlayView({ status: "playing", ready: true })).toBeNull();
    expect(overlayView({ status: "buffering", ready: true })).toBeNull();
  });
});

describe("застарілі дані", () => {
  const base = { status: "playing", paused: false, seeking: null, clock: 100000, replayStart: 0 };
  it("> 10 с без подій", () => {
    expect(staleSeconds({ ...base, lastEventAt: 95000 })).toBeNull();
    expect(staleSeconds({ ...base, lastEventAt: 85000 })).toBe(15);
    expect(staleSeconds({ ...base, lastEventAt: null })).toBe(100);
  });
  it("лише під час відтворення", () => {
    expect(staleSeconds({ ...base, lastEventAt: 0, paused: true })).toBeNull();
    expect(staleSeconds({ ...base, lastEventAt: 0, status: "buffering" })).toBeNull();
    expect(staleSeconds({ ...base, lastEventAt: 0, seeking: { offset: 1 } })).toBeNull();
  });
});

describe("фінальна класифікація", () => {
  it("лише рядки з позицією, з лімітом", () => {
    const rows = [
      { position: 1, driverNumber: 4, driver: { acronym: "NOR", color: "#f80" }, gapToLeader: 0, isLeader: true, bestLapTime: 71.2 },
      { position: 2, driverNumber: 1, driver: { acronym: "VER", color: "#36f" }, gapToLeader: 3.2, bestLapTime: 71.5 },
      { position: null, driverNumber: 99, driver: null },
    ];
    const out = finalClassification(rows, { limit: 10 });
    expect(out.map((r) => r.acronym)).toEqual(["NOR", "VER"]);
    expect(out[1]).toMatchObject({ gap: 3.2, bestLap: 71.5, isLeader: false });
    expect(finalClassification(rows, { limit: 1 }).length).toBe(1);
  });
});
