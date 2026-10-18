import type { Box } from "../layout";
import { transition } from "../motion";
import { mixSky, type SkyColours } from "../palette";
import type { SkySpan } from "./models";

/** What every scene receives. Scenes are pure functions of these. */
export type SceneProps<S> = {
  state: S;
  /** Absolute seconds of the frame being drawn. */
  t: number;
  frame: number;
  fps: number;
  /** The target's stage: readable elements are laid out against it. */
  stage: Box;
  /** Seed for anything scattered; stable across a shot. */
  seed: string;
};

/** Sky colours at time t for a sky span. */
export const skyAt = (span: SkySpan, t: number): SkyColours => {
  const p = transition(t - span.start, span.end - span.start);
  return mixSky(span.from, span.to, span.mixFrom + (span.mixTo - span.mixFrom) * p);
};

/** Labels on readable elements; the safe-zone check measures these. */
export const READABLE = {
  dayCard: "day-card",
  tallyCard: "tally-card",
  endCard: "end-card",
  captions: "captions",
  hiddenFigure: "hidden-figure",
  print: "handprint",
} as const;
