import { FIGURE, FRAME, HORIZON_Y } from "../layout";
import { after, fall, jolt, transition } from "../motion";
import { drift } from "../motion";
import { CHARACTER, PALETTE } from "../palette";
import { Backdrop } from "../primitives/Backdrop";
import { Dust } from "../primitives/Dust";
import { Figure } from "../primitives/Figure";
import { Fragments } from "../primitives/Fragments";
import { Ground } from "../primitives/Ground";
import { Sky } from "../primitives/Sky";
import { cabWindowRect, trailerLeft, VEHICLE, Vehicle } from "../primitives/Vehicle";
import { hashSeed } from "../lib/rng";
import { skyAt, type SceneProps } from "./common";
import type { RoadtrainState } from "./models";

/** The road train across the frame: cab at the right, three trailers bleeding off the left. */
const TRUCK = { scale: 0.6, cabRight: 1052, groundY: 1360, trailers: 3 } as const;
const ORIGIN = { x: TRUCK.cabRight - VEHICLE.cab.w * TRUCK.scale, y: TRUCK.groundY };

/** Cal lies on the ground under the second trailer, one arm up to the chassis. */
const CAL_SCALE = 0.55;
const CAL_ARM_UP = 138;

export const RoadtrainSideScene: React.FC<SceneProps<RoadtrainState>> = ({ state, t, seed }) => {
  const sky = skyAt(state.sky, t);
  const shakeOffset = state.jolt === null ? { dx: 0, dy: 0 } : jolt(t - state.jolt.at, state.jolt.duration, state.jolt.px, seed);
  const windowRect = cabWindowRect(ORIGIN, TRUCK.scale);
  const glassFalling = state.glassAt !== null && after(t, state.glassAt);
  const glassIntact = state.glassAt === null || !glassFalling;

  // Under trailer 1 (the second), feet toward the cab, head toward the back.
  const trailerMid = ORIGIN.x + (trailerLeft(1) + VEHICLE.trailer.w * 0.55) * TRUCK.scale;
  const calBase = { x: trailerMid + FIGURE.height * CAL_SCALE * 0.5, y: TRUCK.groundY - FIGURE.headRadius * CAL_SCALE };

  const flashOpacity =
    state.flash === null || !after(t, state.flash.at)
      ? 0
      : state.flash.drain === null
        ? 1
        : 1 - transition(t - state.flash.at, state.flash.drain);

  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
      <g transform={`translate(${shakeOffset.dx} ${shakeOffset.dy})`}>
        <Sky colours={sky} horizonY={HORIZON_Y} id={`sky-${seed}`} />
        <Ground colour={sky.ground} horizonY={HORIZON_Y} horizonLine={sky.horizon} />
        {state.dust === null || !after(t, state.dust.since) ? null : (
          <Dust
            horizonY={HORIZON_Y}
            colour={PALETTE.daySky}
            drift={drift(t - state.dust.since, state.dust.drift)}
            seed={hashSeed(`${seed}:dust`)}
          />
        )}
        <Vehicle
          origin={ORIGIN}
          scale={TRUCK.scale}
          trailers={TRUCK.trailers}
          colours={{
            body: PALETTE.roadDash,
            window: PALETTE.ink,
            wheel: PALETTE.ink,
            rail: PALETTE.ink,
            door: PALETTE.road,
          }}
          windowSurface={
            glassIntact ? (
              <rect
                x={VEHICLE.cabWindow.x}
                y={VEHICLE.cabWindow.y}
                width={VEHICLE.cabWindow.w}
                height={VEHICLE.cabWindow.h}
                fill={PALETTE.text}
                opacity={0.22}
              />
            ) : null
          }
        />
        {state.cal === null ? null : (
          <Figure
            base={calBase}
            colour={CHARACTER.cal}
            scale={CAL_SCALE}
            facing="away"
            mouthCurve={0}
            rotation={-90}
            arms={[-8, CAL_ARM_UP]}
          />
        )}
        {glassFalling && state.glassAt !== null ? (
          <Fragments
            source={windowRect}
            count={28}
            size={[6, 6]}
            colour={PALETTE.text}
            seed={hashSeed(`${seed}:glass`)}
            fallen={fall(t - state.glassAt, "gravity")}
            floorY={TRUCK.groundY}
            spread={40}
          />
        ) : null}
      </g>
      {flashOpacity > 0 ? <Backdrop colour={PALETTE.flash} opacity={flashOpacity} /> : null}
    </svg>
  );
};
