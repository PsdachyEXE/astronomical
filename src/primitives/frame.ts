import { FRAME } from "../layout";

/** Scenery draws this far past every frame edge so shakes and pushes never show a gap. */
export const BLEED = 120;

export const BLEED_BOX = {
  x: -BLEED,
  y: -BLEED,
  w: FRAME.width + 2 * BLEED,
  h: FRAME.height + 2 * BLEED,
} as const;
