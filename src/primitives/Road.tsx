import { FRAME, type Point } from "../layout";
import { BLEED } from "./frame";

/**
 * Road projection. Depth d is in road units with d = 1 at the frame's bottom
 * edge; a point X units across the road at depth d lands at
 * (vp.x + X * pxPerUnit / d, vp.y + (frame bottom - vp.y) / d).
 */
export type RoadProjection = { vp: Point; pxPerUnit: number };

export const project = (p: RoadProjection, across: number, depth: number): Point => ({
  x: p.vp.x + (across * p.pxPerUnit) / depth,
  y: p.vp.y + (FRAME.height - p.vp.y) / depth,
});

/** Screen scale of something at a given depth, relative to its size at d = 1. */
export const depthScale = (depth: number): number => 1 / depth;

export type RoadProps = {
  projection: RoadProjection;
  /** Half the road's width, in road units. */
  halfWidth: number;
  colour: string;
  dashColour: string;
  /** Road units travelled; the dashes slide toward the camera as this grows. */
  travelled: number;
  dashLength?: number;
  dashSpacing?: number;
  dashHalfWidth?: number;
};

const NEAREST = 1 - BLEED / 400;
const FARTHEST = 80;

/** A wedge from the bottom edge to the vanishing point, with a dashed centre line. */
export const Road: React.FC<RoadProps> = ({
  projection,
  halfWidth,
  colour,
  dashColour,
  travelled,
  dashLength = 0.75,
  dashSpacing = 3,
  dashHalfWidth = 0.016,
}) => {
  const near = NEAREST;
  const leftNear = project(projection, -halfWidth, near);
  const rightNear = project(projection, halfWidth, near);
  const phase = ((-travelled % dashSpacing) + dashSpacing) % dashSpacing;
  const dashes: Point[][] = [];
  for (let d = near + phase - dashSpacing; d < FARTHEST; d += dashSpacing) {
    const d0 = Math.max(near, d);
    const d1 = d + dashLength;
    if (d1 <= d0) continue;
    dashes.push([
      project(projection, -dashHalfWidth, d0),
      project(projection, dashHalfWidth, d0),
      project(projection, dashHalfWidth, d1),
      project(projection, -dashHalfWidth, d1),
    ]);
  }
  const pts = (ps: Point[]) => ps.map((p) => `${p.x},${p.y}`).join(" ");
  return (
    <g>
      <polygon points={pts([projection.vp, rightNear, leftNear])} fill={colour} />
      {dashes.map((quad, i) => (
        <polygon key={i} points={pts(quad)} fill={dashColour} />
      ))}
    </g>
  );
};
