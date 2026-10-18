import { describe, expect, it } from "vitest";
import {
  captionBox,
  cardLayout,
  contains,
  figureBox,
  HIDDEN_FIGURE,
  NIGHT_DOOR_WINDOW,
  PRINT_BOX,
  scaleAbout,
  VANISHING_POINT,
} from "../src/layout";
import { stageFor, TARGET_IDS, UNIVERSAL_STAGE } from "../src/platforms";

describe("layout", () => {
  it("reproduces the bible's card centre (y 860) and caption line (y 1440) on the universal stage", () => {
    const card = cardLayout(UNIVERSAL_STAGE, { dayText: "DAY 1", marks: 1 });
    expect(card.centre.y).toBe(860);
    const cap = captionBox(UNIVERSAL_STAGE, ["one row"]);
    expect(cap.y + cap.h / 2).toBeCloseTo(1440, 6);
  });

  it("keeps the hidden figure inside the universal stage and under 40 px at every push scale", () => {
    for (let s = 1; s <= 1.06 + 1e-9; s += 0.005) {
      const box = scaleAbout(figureBox(HIDDEN_FIGURE.feet, HIDDEN_FIGURE.scale), VANISHING_POINT, s);
      expect(contains(UNIVERSAL_STAGE, box)).toBe(true);
      expect(box.h).toBeLessThanOrEqual(HIDDEN_FIGURE.maxHeight);
    }
  });

  it("puts the handprint on the door window, inside the universal stage", () => {
    expect(contains(NIGHT_DOOR_WINDOW, PRINT_BOX)).toBe(true);
    expect(contains(UNIVERSAL_STAGE, PRINT_BOX)).toBe(true);
  });

  it("fits cards of up to 30 marks and two-row captions inside every stage", () => {
    for (const id of TARGET_IDS) {
      const stage = stageFor(id);
      for (let marks = 0; marks <= 30; marks++) {
        expect(contains(stage, cardLayout(stage, { dayText: "DAY 36", marks }).box)).toBe(true);
      }
      expect(contains(stage, captionBox(stage, ["x".repeat(31), "y".repeat(31)]))).toBe(true);
    }
  });
});
