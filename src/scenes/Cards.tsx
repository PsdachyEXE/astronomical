import { cardLayout, FRAME } from "../layout";
import { drawOnSequence, fadeOut, strike } from "../motion";
import { PALETTE } from "../palette";
import { Backdrop } from "../primitives/Backdrop";
import { Card } from "../primitives/Card";
import { READABLE, type SceneProps } from "./common";
import type { DayCardState, EndCardState, TallyCardState } from "./models";

const Frame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
    <Backdrop colour={PALETTE.black} />
    {children}
  </svg>
);

/** Black. DAY n at centre; the opening tally draws on beneath it, one stroke after another. */
export const DayCardScene: React.FC<SceneProps<DayCardState>> = ({ state, frame, fps, stage }) => {
  const geometry = cardLayout(stage, { dayText: state.dayText, marks: state.marks, struck: state.struck });
  const startFrame = Math.round(state.drawStart * fps);
  return (
    <Frame>
      <Card
        geometry={geometry}
        dayText={state.dayText}
        strokeProgress={(k) => drawOnSequence(frame, startFrame, k)}
        strikeProgress={() => 1}
        readable={READABLE.dayCard}
      />
    </Frame>
  );
};

/** Delay before a change draws on, so the card registers first. */
const CHANGE_DELAY_FRAMES = 6;

/** The 1.2-second interstitial at a tally change: the new mark draws on, or a strike goes through. */
export const TallyCardScene: React.FC<SceneProps<TallyCardState>> = ({ state, frame, fps, stage }) => {
  const geometry = cardLayout(stage, { dayText: null, marks: state.marks, struck: state.struck });
  const from = Math.round(state.start * fps) + CHANGE_DELAY_FRAMES;
  return (
    <Frame>
      <Card
        geometry={geometry}
        dayText={null}
        strokeProgress={(mark) => {
          const k = state.drawMarks.indexOf(mark);
          return k < 0 ? 1 : drawOnSequence(frame, from, k);
        }}
        strikeProgress={(mark) => (state.strikeMarks.includes(mark) ? strike(frame - from) : 1)}
        readable={READABLE.tallyCard}
      />
    </Frame>
  );
};

/** Black. The closing tally, centred, fades to nothing; the last frames are pure black for the loop seam. */
export const EndCardScene: React.FC<SceneProps<EndCardState>> = ({ state, t, stage }) => {
  const geometry = cardLayout(stage, { dayText: null, marks: state.marks, struck: state.struck });
  const opacity = fadeOut(t - state.fadeStart, state.fadeEnd - state.fadeStart, 2);
  return (
    <Frame>
      {opacity > 0 ? (
        <Card
          geometry={geometry}
          dayText={null}
          strokeProgress={() => 1}
          strikeProgress={() => 1}
          opacity={opacity}
          readable={READABLE.endCard}
        />
      ) : null}
    </Frame>
  );
};
