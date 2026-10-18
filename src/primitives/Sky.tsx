import type { SkyColours } from "../palette";
import { BLEED, BLEED_BOX } from "./frame";

export type SkyProps = {
  colours: SkyColours;
  horizonY: number;
  /** Unique per frame; the dusk sky needs a gradient definition. */
  id: string;
};

/**
 * The sky above the horizon. Flat for day, drained, night and flash. Dusk is
 * the two-stop vertical gradient, the only gradient in the series.
 */
export const Sky: React.FC<SkyProps> = ({ colours, horizonY, id }) => {
  const flat = colours.top === colours.bottom;
  const height = horizonY + BLEED;
  return (
    <g>
      {flat ? null : (
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={horizonY}>
            <stop offset={0} stopColor={colours.top} />
            <stop offset={1} stopColor={colours.bottom} />
          </linearGradient>
        </defs>
      )}
      <rect
        x={BLEED_BOX.x}
        y={BLEED_BOX.y}
        width={BLEED_BOX.w}
        height={height}
        fill={flat ? colours.top : `url(#${id})`}
      />
    </g>
  );
};
