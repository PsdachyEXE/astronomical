import { describe, expect, it } from "vitest";
import {
  collapse,
  COLLAPSE_FRAMES,
  drawOn,
  fall,
  flinch,
  idle,
  jolt,
  push,
  shake,
  stepTimes,
  still,
  strike,
  turn,
  walk,
} from "../src/motion";

describe("figure moves", () => {
  it("idle breathes between 1.00 and 1.02 on a 3 s loop", () => {
    expect(idle(0).growth).toBeCloseTo(1, 6);
    expect(idle(1.5).growth).toBeCloseTo(1.02, 6);
    expect(idle(3).growth).toBeCloseTo(1, 6);
  });

  it("walk bobs ±6 px and swings ±25° with a foot down every 0.8 s", () => {
    for (const t of [0, 0.8, 1.6]) expect(walk(t).lift).toBeCloseTo(6, 6);
    expect(walk(0.4).lift).toBeCloseTo(-6, 6);
    expect(walk(0).legs?.[0]).toBeCloseTo(25, 6);
    expect(walk(0.8).legs?.[0]).toBeCloseTo(-25, 6);
    expect(stepTimes(2.5).map((t) => Math.round(t * 10) / 10)).toEqual([0, 0.8, 1.6, 2.4]);
  });

  it("turn slides the mouth across in 6 frames", () => {
    expect(turn(0, -1, 1)).toBe(-1);
    expect(turn(6, -1, 1)).toBe(1);
    expect(turn(3, -1, 1)).toBeCloseTo(0, 6);
  });

  it("flinch squashes to 0.92 for 2 frames, jumps 8 px, and is done by frame 10", () => {
    expect(flinch(0).squash).toBe(0.92);
    expect(flinch(1).squash).toBe(0.92);
    expect(Math.min(...[2, 3, 4, 5, 6, 7, 8, 9].map((f) => flinch(f).lift))).toBeCloseTo(-8, 0);
    expect(flinch(10)).toEqual(still());
  });

  it("collapse rotates 90° to the ground in 18 frames", () => {
    expect(collapse(COLLAPSE_FRAMES, 100).rotation).toBe(90);
    expect(collapse(COLLAPSE_FRAMES, 100).lift).toBe(100);
    expect(collapse(0, 100).rotation).toBe(0);
  });

  it("strike takes 12 frames and a stroke draws on in 6", () => {
    expect(strike(6)).toBe(0.5);
    expect(strike(12)).toBe(1);
    expect(drawOn(3)).toBe(0.5);
    expect(drawOn(6)).toBe(1);
  });
});

describe("environment moves", () => {
  it("push runs 1.00 to 1.06 across the span", () => {
    expect(push(0, 5, 1, 1.06)).toBe(1);
    expect(push(5, 5, 1, 1.06)).toBeCloseTo(1.06, 9);
  });

  it("jolt is deterministic, at most 4 px, and only inside its span", () => {
    expect(jolt(0.1, 0.5, 4, "C04")).toEqual(jolt(0.1, 0.5, 4, "C04"));
    for (let f = 0; f < 15; f++) {
      const j = jolt(f / 30, 0.5, 4, "C04");
      expect(Math.abs(j.dx)).toBeLessThanOrEqual(4);
      expect(Math.abs(j.dy)).toBeLessThanOrEqual(4);
    }
    expect(jolt(0.5, 0.5, 4, "C04")).toEqual({ dx: 0, dy: 0 });
  });

  it("door shake peaks at 6 px and settles", () => {
    expect(shake(0, 6)).toBe(6);
    expect(shake(6, 6)).toBe(0);
  });

  it("rain falls at 1,400 px per second", () => {
    expect(fall(1, "rain")).toBe(1400);
  });
});
