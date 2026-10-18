import { FRAME, HIDDEN_FIGURE, HORIZON_Y, VANISHING_POINT } from "../layout";
import { after, push, scroll, still, walk, walkStopsAt } from "../motion";
import { CHARACTER, PALETTE } from "../palette";
import { Car } from "../primitives/Car";
import { Figure } from "../primitives/Figure";
import { Ground } from "../primitives/Ground";
import { depthScale, project, Road, type RoadProjection } from "../primitives/Road";
import { Sky } from "../primitives/Sky";
import { Smudge } from "../primitives/Smudge";
import { Sun } from "../primitives/Sun";
import { hashSeed } from "../lib/rng";
import { READABLE, skyAt, type SceneProps } from "./common";
import type { HighwayState } from "./models";

const PROJECTION: RoadProjection = { vp: VANISHING_POINT, pxPerUnit: 457 };
const ROAD_HALF_WIDTH = 0.875;
/** Road units per second while Cal walks; the figure stays put and the dashes come to meet it. */
const WALK_PACE = 0.55;

/** Stopped cars, far to near: across the road, depth, which side the open door hangs. */
const CARS: readonly { across: number; depth: number; door: -1 | 1 }[] = [
  { across: -0.46, depth: 26, door: -1 },
  { across: 0.48, depth: 17, door: 1 },
  { across: -0.5, depth: 11.5, door: -1 },
  { across: 0.52, depth: 7.6, door: 1 },
  { across: -0.45, depth: 5.0, door: -1 },
  { across: 0.5, depth: 3.4, door: 1 },
  { across: -0.52, depth: 2.25, door: -1 },
];
const CAR_SCALE = 0.95;

/** Cal walks away from camera in the left lane, near the bottom of frame. */
const CAL = { across: -0.22, depth: 1.28, scale: 1 } as const;

const SUN = { x: 852, y: 1012, r: 46 } as const;
const SMUDGE = { x: 190, width: 280, height: 64 } as const;

export const HighwayWalkScene: React.FC<SceneProps<HighwayState>> = ({ state, t, seed }) => {
  const sky = skyAt(state.sky, t);
  const scale = state.push === null ? 1 : push(t - state.push.start, state.push.end - state.push.start, state.push.from, state.push.to);
  const walking = state.cal.move === "walk";
  const walked = t - state.cal.since;
  const stopAt = state.cal.until === null ? Number.POSITIVE_INFINITY : walkStopsAt(state.cal.until - state.cal.since);
  const moving = walking && walked < stopAt;
  const travelled = walking ? scroll(Math.min(walked, stopAt), WALK_PACE) : 0;
  const pose = moving ? walk(walked) : still();
  const calBase = project(PROJECTION, CAL.across, CAL.depth);
  const showHidden = state.hidden !== null && after(t, state.hidden.from);
  const vp = VANISHING_POINT;

  return (
    <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
      <g transform={`translate(${vp.x} ${vp.y}) scale(${scale}) translate(${-vp.x} ${-vp.y})`}>
        <Sky colours={sky} horizonY={HORIZON_Y} id={`sky-${seed}`} />
        {state.sun ? <Sun centre={{ x: SUN.x, y: SUN.y }} radius={SUN.r} colour={PALETTE.text} opacity={0.55} /> : null}
        <Ground colour={sky.ground} horizonY={HORIZON_Y} horizonLine={sky.horizon} />
        {state.smudge ? (
          <Smudge
            centre={{ x: SMUDGE.x, y: HORIZON_Y }}
            width={SMUDGE.width}
            height={SMUDGE.height}
            colour={PALETTE.ink}
            seed={hashSeed(`${seed}:smudge`)}
          />
        ) : null}
        <Road
          projection={PROJECTION}
          halfWidth={ROAD_HALF_WIDTH}
          colour={PALETTE.road}
          dashColour={PALETTE.roadDash}
          travelled={travelled}
        />
        {showHidden ? (
          <Figure
            base={HIDDEN_FIGURE.feet}
            colour={CHARACTER.nine}
            scale={HIDDEN_FIGURE.scale}
            facing="camera"
            mouthCurve={0}
            readable={READABLE.hiddenFigure}
          />
        ) : null}
        {CARS.slice(CARS.length - state.cars).map((car, i) => (
          <Car
            key={i}
            base={project(PROJECTION, car.across, car.depth)}
            scale={CAR_SCALE * depthScale(car.depth)}
            colour={PALETTE.roadDash}
            doorColour={PALETTE.roadDash}
            doorSide={car.door}
          />
        ))}
        <Figure
          base={calBase}
          colour={CHARACTER.cal}
          scale={CAL.scale}
          facing="away"
          mouthCurve={0}
          lift={pose.lift}
          arms={pose.arms ?? undefined}
          legs={pose.legs ?? undefined}
        />
      </g>
    </svg>
  );
};
