import { FIGURE, FRAME, HORIZON_Y, type Box } from "../layout";
import { after, pulse, transition } from "../motion";
import { CHARACTER, PALETTE } from "../palette";
import { CabInterior } from "../primitives/CabInterior";
import { Figure } from "../primitives/Figure";
import { Ground } from "../primitives/Ground";
import { Radio } from "../primitives/Radio";
import { Sky } from "../primitives/Sky";
import { Sun } from "../primitives/Sun";
import { skyAt, type SceneProps } from "./common";
import type { CabInteriorState, SunPosition } from "./models";

/** The windscreen frames the horizon. */
const WINDSCREEN: Box = { x: 56, y: 640, w: 968, h: 650 };
const SUN = { x: 712, r: 54 } as const;
const SUN_Y: Record<SunPosition, number> = {
  above: HORIZON_Y - SUN.r - 70,
  touching: HORIZON_Y - SUN.r,
  below: HORIZON_Y + SUN.r + 4,
};
/** Cal's head from behind, lower centre. */
const CAL = { x: 540, headY: 1712, scale: 4.2 } as const;
const RADIO = { x: 84, y: 1612 } as const;

export const CabInteriorScene: React.FC<SceneProps<CabInteriorState>> = ({ state, t, seed }) => {
  const sky = skyAt(state.sky, t);
  const sunT = transition(t - state.sun.start, state.sun.end - state.sun.start);
  const sunY = SUN_Y[state.sun.from] + (SUN_Y[state.sun.to] - SUN_Y[state.sun.from]) * sunT;
  const r = state.radio;
  const on = r.on !== null && after(t, r.on) && !(r.off !== null && after(t, r.off));
  const level = !on ? 0 : r.words.length > 0 ? pulse(t, r.words) : 1;
  const headOffset = -FIGURE.legLength - FIGURE.torsoHeight - FIGURE.neckGap - FIGURE.headRadius;
  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
      <Sky colours={sky} horizonY={HORIZON_Y} id={`sky-${seed}`} />
      <Sun centre={{ x: SUN.x, y: sunY }} radius={SUN.r} colour={PALETTE.text} opacity={0.7} />
      <Ground colour={sky.ground} horizonY={HORIZON_Y} horizonLine={sky.horizon} />
      <CabInterior windscreen={WINDSCREEN} colour={PALETTE.ink} />
      <Radio at={RADIO} body={PALETTE.road} light={PALETTE.text} level={level} />
      <Figure
        base={{ x: CAL.x, y: CAL.headY - headOffset * CAL.scale }}
        colour={CHARACTER.cal}
        scale={CAL.scale}
        facing="away"
        mouthCurve={0}
        arms={[-4, 4]}
      />
    </svg>
  );
};
