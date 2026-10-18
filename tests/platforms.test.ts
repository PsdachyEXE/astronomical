import { describe, expect, it } from "vitest";
import { contains, FRAME } from "../src/layout";
import {
  DURATION_GUARD,
  PLATFORM_IDS,
  platformConfig,
  stageFor,
  TARGET_IDS,
  UNIVERSAL_STAGE,
} from "../src/platforms";

describe("platforms", () => {
  it("universal stage is x 72 to 948, y 220 to 1540", () => {
    expect(UNIVERSAL_STAGE).toEqual({ x: 72, y: 220, w: 876, h: 1320 });
  });

  it("master lays out on the universal stage", () => {
    expect(stageFor("master")).toEqual(UNIVERSAL_STAGE);
  });

  it("every platform stage contains the universal stage", () => {
    for (const id of PLATFORM_IDS) {
      expect(contains(stageFor(id), UNIVERSAL_STAGE)).toBe(true);
    }
  });

  it("every stage sits inside the frame", () => {
    for (const id of TARGET_IDS) {
      expect(contains({ x: 0, y: 0, w: FRAME.width, h: FRAME.height }, stageFor(id))).toBe(true);
    }
  });

  it("the runtime guard fits inside every platform's length window", () => {
    for (const id of PLATFORM_IDS) {
      const { min, max } = platformConfig(id).duration;
      expect(DURATION_GUARD.min).toBeGreaterThanOrEqual(min);
      expect(DURATION_GUARD.max).toBeLessThan(max);
    }
  });

  it("variants share the master's end-card hold, so runtime never differs", () => {
    const hold = platformConfig("master").endCardHold;
    for (const id of TARGET_IDS) {
      expect(platformConfig(id).endCardHold).toBe(hold);
    }
  });

  it("every encode preset is H.264 high profile with AAC 192 kbps", () => {
    for (const id of TARGET_IDS) {
      const e = platformConfig(id).encode;
      expect(e.profile).toBe("high");
      expect(e.audioKbps).toBe(192);
    }
  });

  it("every platform names a source for its safe-zone numbers", () => {
    for (const id of PLATFORM_IDS) {
      const src = platformConfig(id).safeZoneSource;
      expect(src.url).toMatch(/^https:\/\//);
      expect(src.retrieved).toMatch(/\d{4}-\d{2}-\d{2}/);
    }
  });
});
