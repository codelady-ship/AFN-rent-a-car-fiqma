import { describe, expect, it } from "vitest";
import { REDUCED, TRACK, ZOOM, coverAt, drumAt, drumHold, fieldLayout, flightAt, flipAt, flyAt, nextStop, pileCount, poseFor, progressFrom, smooth, titleGapAt, wordsAt, zoomBox, zoomPoses } from "./story";

describe("scroll story", () => {
  it("progress is 0 before the pin, 1 after it, linear in between", () => {
    expect(progressFrom(100, 600, 100)).toBe(0);
    expect(progressFrom(-250, 600, 100)).toBe(0.5);
    expect(progressFrom(-2000, 600, 100)).toBe(1);
    expect(progressFrom(0, 100, 100)).toBe(0); // no travel: never NaN
  });

  it("smootherstep starts and ends flat", () => {
    expect(smooth(0)).toBe(0);
    expect(smooth(1)).toBe(1);
    expect(smooth(0.5)).toBeCloseTo(0.5);
    expect(smooth(-3)).toBe(0);
  });

  it("photo field keeps clear of the headline and stays on screen-ish", () => {
    const pts = fieldLayout(18, 11);
    expect(pts).toHaveLength(18);
    for (const p of pts) expect(Math.abs(p.x) >= 0.42 || Math.abs(p.y) >= 0.36).toBe(true);
    const q = flyAt(0.5, 0.5, 3, 0, 1000, 800);
    expect(q.o).toBeGreaterThan(0);
    expect(q.x).toBeGreaterThan(500);
  });

  it("the zoom box grows from the gap to the full stage", () => {
    const start = zoomBox(0, 0, 1000, 800, 140, 87);
    expect(start.w).toBe(0);
    const open = zoomBox(1, 0, 1000, 800, 140, 87);
    expect(open.w).toBe(140);
    const full = zoomBox(1, 1, 1000, 800, 140, 87);
    expect(full).toMatchObject({ x: 0, y: 0, w: 1000, h: 800, r: 0 });
  });

  it("the flicker only runs while the gap opens", () => {
    expect(flipAt(0.05, 8)).toBe(-1);
    expect(flipAt(0.18, 8)).toBeGreaterThanOrEqual(0);
    expect(flipAt(0.3, 8)).toBe(-1);
  });

  it("the kit card flies from the column through the title into its slot", () => {
    const a = { x: 0, y: 0, w: 100 };
    const m = { x: 50, y: 50, w: 60 };
    const b = { x: 100, y: 200, w: 80 };
    expect(flightAt(0, a, m, b)).toEqual(a);
    expect(flightAt(0.5, a, m, b)).toEqual(m);
    expect(flightAt(1, a, m, b)).toEqual(b);
    expect(titleGapAt(0)).toBe(0);
    expect(titleGapAt(0.55)).toBe(1);
    expect(titleGapAt(1)).toBe(0);
  });

  it("the class drum holds each class dead centre", () => {
    const n = 5;
    for (let i = 0; i < n; i++) expect(drumAt(drumHold(i, n), n)).toBeCloseTo(i, 5);
    expect(drumAt(0, n)).toBe(0);
    expect(drumAt(1, n)).toBe(n - 1);
    expect(drumHold(0, n)).toBe(ZOOM.drum[0]);
  });

  it("giant words: arriving amount decreases as the column scrolls up", () => {
    const early = wordsAt(0, 0, 800, 3);
    const late = wordsAt(1, 1, 800, 3);
    expect(early.e[0]).toBeGreaterThan(late.e[0]);
  });

  it("pile count grows with scroll", () => {
    expect(pileCount(0, 18)).toBe(0);
    expect(pileCount(1, 18)).toBe(18);
  });

  it("reduced motion snaps between still poses", () => {
    expect(poseFor(0.1, REDUCED.intro)).toBe(0);
    expect(poseFor(0.5, REDUCED.intro)).toBe(0.79);
    const poses = zoomPoses(5);
    expect(poses).toHaveLength(6);
    expect(poseFor(0.95, poses)).toBe(drumHold(4, 5));
  });

  it("the next button goes to the next stop below, or -1 at the end", () => {
    expect(nextStop([100, 500, 900], 0)).toBe(100);
    expect(nextStop([100, 500, 900], 100)).toBe(500);
    expect(nextStop([100, 500, 900], 950)).toBe(-1);
    expect(coverAt(TRACK.intro)).toBeCloseTo(0.8);
  });
});
