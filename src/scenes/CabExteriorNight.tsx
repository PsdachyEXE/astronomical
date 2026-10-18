import { FIGURE, FRAME, HORIZON_Y, NIGHT_DOOR_WINDOW, PRINT_BOX } from "../layout";
import { after, creep, flinch, shake } from "../motion";
import { PALETTE } from "../palette";
import { Backdrop } from "../primitives/Backdrop";
import { Figure } from "../primitives/Figure";
import { Ground } from "../primitives/Ground";
import { HorizonLine } from "../primitives/HorizonLine";
import { Print } from "../primitives/Print";
import { Sky } from "../primitives/Sky";
import { originForCabWindow, VEHICLE, Vehicle } from "../primitives/Vehicle";
import { SKY } from "../palette";
import { READABLE, type SceneProps } from "./common";
import type { CabNightState } from "./models";

const CAB = originForCabWindow(NIGHT_DOOR_WINDOW);
const DOOR_SHAKE_PX = 6;
/** Dawn creeps in from the right edge. */
const DAWN_SPEED = 150;
const LIT_WINDOW_OPACITY = 0.2;

/** Cal inside the cab, in window units (the window is 120 x 78 at 1.0 scale). */
const INSIDE = { scale: 0.3, x: VEHICLE.cabWindow.w * 0.42 } as const;

export const CabExteriorNightScene: React.FC<SceneProps<CabNightState>> = ({ state, t, frame, fps }) => {
  const night = SKY.night;
  const lit = state.windowLit && !(state.windowOff !== null && after(t, state.windowOff));
  const doorPx = state.shakes.reduce((dx, at) => dx + shake(frame - Math.round(at * fps), DOOR_SHAKE_PX), 0);
  const upright = state.cal.upAt !== null && after(t, state.cal.upAt);
  const jump = upright && state.cal.upAt !== null ? flinch(frame - Math.round(state.cal.upAt * fps)) : null;
  const headRise = FIGURE.legLength + FIGURE.torsoHeight + FIGURE.neckGap + FIGURE.headRadius;

  const inside =
    !lit || state.cal.pose === "hidden" ? null : upright ? (
      <Figure
        base={{ x: INSIDE.x, y: 30 + headRise * INSIDE.scale }}
        colour={PALETTE.ink}
        scale={INSIDE.scale}
        facing="away"
        mouthCurve={0}
        lift={jump?.lift ?? 0}
        squash={jump?.squash ?? 1}
      />
    ) : (
      <Figure
        base={{ x: INSIDE.x + FIGURE.height * INSIDE.scale * 0.5, y: VEHICLE.cabWindow.h + 4 }}
        colour={PALETTE.ink}
        scale={INSIDE.scale}
        facing="away"
        mouthCurve={0}
        rotation={-90}
      />
    );

  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
      <Sky colours={night} horizonY={HORIZON_Y} id="sky-night" />
      <Ground colour={night.ground} horizonY={HORIZON_Y} horizonLine={night.horizon} />
      {state.dawnFrom !== null && after(t, state.dawnFrom) ? (
        <HorizonLine
          horizonY={HORIZON_Y}
          fromX={FRAME.width}
          length={-creep(t - state.dawnFrom, DAWN_SPEED)}
          colour={PALETTE.daySky}
          width={4}
          opacity={0.75}
        />
      ) : null}
      <Vehicle
        origin={CAB.origin}
        scale={CAB.scale}
        trailers={1}
        colours={{ body: PALETTE.ink, window: PALETTE.ink, wheel: PALETTE.ink, rail: PALETTE.ink, door: PALETTE.nightHorizon }}
        doorOffset={doorPx / CAB.scale}
        windowContents={
          lit ? (
            <>
              <rect x={0} y={0} width={VEHICLE.cabWindow.w} height={VEHICLE.cabWindow.h} fill={PALETTE.text} opacity={LIT_WINDOW_OPACITY} />
              {inside}
            </>
          ) : null
        }
      />
      {state.printFrom !== null && after(t, state.printFrom) ? (
        <Print box={PRINT_BOX} colour={PALETTE.text} opacity={0.3} readable={READABLE.print} />
      ) : null}
      {state.blackAt !== null && after(t, state.blackAt) ? <Backdrop colour={PALETTE.black} /> : null}
    </svg>
  );
};
