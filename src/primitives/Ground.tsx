import { BLEED_BOX } from "./frame";

export type GroundProps = {
  colour: string;
  horizonY: number;
  /** Night draws a horizon line; other times leave the edge bare. */
  horizonLine: string | null;
};

const LINE_WIDTH = 3;

/** The band below the horizon, to the frame edge and past it. */
export const Ground: React.FC<GroundProps> = ({ colour, horizonY, horizonLine }) => (
  <g>
    <rect
      x={BLEED_BOX.x}
      y={horizonY}
      width={BLEED_BOX.w}
      height={BLEED_BOX.y + BLEED_BOX.h - horizonY}
      fill={colour}
    />
    {horizonLine === null ? null : (
      <rect
        x={BLEED_BOX.x}
        y={horizonY - LINE_WIDTH / 2}
        width={BLEED_BOX.w}
        height={LINE_WIDTH}
        fill={horizonLine}
      />
    )}
  </g>
);
