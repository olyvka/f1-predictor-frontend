import { describe, it, expect } from "vitest";
import { buildTrackGeometry, projectOnTrack, isInPitLane, fitRotation, toScreen, unwrapLapFraction, PIT_LANE_DISTANCE } from "../geometry";
import quali from "../__fixtures__/brazil-2026-quali.json";

// Квадрат 1000×1000, обхід проти годинникової: довжина 4000.
const SQUARE = [
  [0, 0],
  [1000, 0],
  [1000, 1000],
  [0, 1000],
];

describe("geometry", () => {
  it("будує відрізки й довжину", () => {
    const g = buildTrackGeometry(SQUARE);
    expect(g.n).toBe(4);
    expect(g.length).toBe(4000);
    expect(g.bbox).toEqual({ minX: 0, minY: 0, maxX: 1000, maxY: 1000 });
    expect(buildTrackGeometry([[0, 0]])).toBeNull();
  });

  it("проєкція: відстань, дуга, частка кола", () => {
    const g = buildTrackGeometry(SQUARE);
    const p = projectOnTrack(g, 500, -40);
    expect(p.distance).toBeCloseTo(40);
    expect(p.s).toBeCloseTo(500);
    expect(p.fraction).toBeCloseTo(0.125);
    expect(p.x).toBeCloseTo(500);
    const q = projectOnTrack(g, 20, 600); // ліва сторона, від (0,1000) до (0,0)
    expect(q.fraction).toBeCloseTo((3000 + 400) / 4000);
    // з підказкою індексу результат той самий
    const out = {};
    projectOnTrack(g, 500, -40, { hint: 0, window: 1, out });
    expect(out.s).toBeCloseTo(500);
  });

  it("піт-лейн за відстанню від контуру", () => {
    const g = buildTrackGeometry(SQUARE);
    expect(isInPitLane(g, 500, -(PIT_LANE_DISTANCE - 20))).toBe(false);
    expect(isInPitLane(g, 500, -(PIT_LANE_DISTANCE + 80))).toBe(true);
    expect(isInPitLane(null, 0, 0)).toBe(false);
  });

  it("на реальних даних: машини на трасі ≤ ~130, у піт-лейні далі 150 (Бразилія 2026, Q)", () => {
    const session = quali.messages.find((m) => m.msg.type === "session").msg;
    const g = buildTrackGeometry(session.track.points);
    const dists = [];
    for (const { msg } of quali.messages) {
      if (msg.type !== "batch") continue;
      for (const e of msg.events) if (e.topic === "location") dists.push(projectOnTrack(g, e.data.x, e.data.y).distance);
    }
    expect(dists.length).toBeGreaterThan(1000);
    const onTrack = dists.filter((d) => d <= PIT_LANE_DISTANCE).length;
    const inPit = dists.filter((d) => d > PIT_LANE_DISTANCE).length;
    // більшість семплів - на трасі, але є й машини в боксах
    expect(onTrack / dists.length).toBeGreaterThan(0.5);
    expect(inPit).toBeGreaterThan(0);
    // між «трасою» і «піт-лейном» майже немає значень (чіткий поріг)
    const between = dists.filter((d) => d > 135 && d < 200).length;
    expect(between / dists.length).toBeLessThan(0.02);
  });

  it("автоповорот: видовжена траса стає вздовж ширшої сторони", () => {
    const tall = [
      [0, 0],
      [100, 0],
      [100, 1000],
      [0, 1000],
    ];
    const fit = fitRotation(tall, 800, 200, { padding: 10 });
    // повернута на ~90°: ширина контейнера використовується під довгу сторону
    expect(Math.abs(Math.sin(fit.angle))).toBeGreaterThan(0.99);
    expect(fit.scale).toBeGreaterThan((200 - 20) / 1000);
    const pt = toScreen(fit, 50, 500);
    expect(pt[0]).toBeCloseTo(400);
    expect(pt[1]).toBeCloseTo(100);
    expect(fitRotation([], 100, 100)).toBeNull();
  });

  it("частка кола біля лінії", () => {
    expect(unwrapLapFraction(0.95, 2, null)).toBeNull(); // ще до лінії на початку кола → −0.05 → відкинуто
    expect(unwrapLapFraction(0.5, 2, null)).toBe(0.5);
    expect(unwrapLapFraction(0.05, 80, 1)).toBeNull(); // уже за лінією в кінці попереднього кола → 1.05 → відкинуто
    expect(unwrapLapFraction(0.98, 80, 1)).toBe(0.98);
    expect(unwrapLapFraction(-1, 10, 10)).toBeNull();
    expect(unwrapLapFraction(null, 10, 10)).toBeNull();
  });
});
