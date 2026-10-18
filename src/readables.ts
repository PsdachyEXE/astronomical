/**
 * Where every readable element is on a given frame, worked out from the same
 * layout functions the components draw with. The safe-zone check sweeps this
 * across every frame of every target; the debug probe cross-checks it
 * against boxes measured in the rendered page.
 */
import { captionBox, cardLayout, figureBox, HIDDEN_FIGURE, PRINT_BOX, scaleAbout, VANISHING_POINT, type Box } from "./layout";
import type { Timeline, TimelineCue } from "./lib/timeline";
import { fadeOut, push } from "./motion";
import { platformConfig, stageFor, type TargetId } from "./platforms";
import { READABLE } from "./scenes/common";

export type Readable = { name: string; box: Box };

const cueAt = (tl: Timeline, frame: number): TimelineCue | null =>
  tl.cues.find((c) => frame >= c.startFrame && frame < c.endFrame) ?? null;

export const readablesAt = (tl: Timeline, target: TargetId, frame: number): Readable[] => {
  const t = frame / tl.fps;
  const stage = stageFor(target);
  const out: Readable[] = [];
  const cue = cueAt(tl, frame);
  if (cue !== null) {
    const s = cue.state;
    switch (s.kind) {
      case "day-card":
        out.push({ name: READABLE.dayCard, box: cardLayout(stage, { dayText: s.dayText, marks: s.marks, struck: s.struck }).box });
        break;
      case "tally-card":
        out.push({ name: READABLE.tallyCard, box: cardLayout(stage, { dayText: null, marks: s.marks, struck: s.struck }).box });
        break;
      case "end-card":
        if (fadeOut(t - s.fadeStart, s.fadeEnd - s.fadeStart, 2) > 0) {
          out.push({ name: READABLE.endCard, box: cardLayout(stage, { dayText: null, marks: s.marks, struck: s.struck }).box });
        }
        break;
      case "highway-walk":
        if (s.hidden !== null && t >= s.hidden.from) {
          const scale = s.push === null ? 1 : push(t - s.push.start, s.push.end - s.push.start, s.push.from, s.push.to);
          out.push({
            name: READABLE.hiddenFigure,
            box: scaleAbout(figureBox(HIDDEN_FIGURE.feet, HIDDEN_FIGURE.scale), VANISHING_POINT, scale),
          });
        }
        break;
      case "cab-exterior-night":
        if (s.printFrom !== null && t >= s.printFrom && !(s.blackAt !== null && t >= s.blackAt)) {
          out.push({ name: READABLE.print, box: PRINT_BOX });
        }
        break;
      default:
        break;
    }
  }
  if (platformConfig(target).captions) {
    const page = tl.captions.find((p) => t >= p.start && t < p.end);
    if (page !== undefined) out.push({ name: READABLE.captions, box: captionBox(stage, page.rows) });
  }
  return out;
};
