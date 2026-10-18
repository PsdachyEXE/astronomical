import { BLEED_BOX } from "./frame";

/** A flat field of one colour over the whole frame: black screens, the flash. */
export const Backdrop: React.FC<{ colour: string; opacity?: number }> = ({ colour, opacity = 1 }) => (
  <rect
    x={BLEED_BOX.x}
    y={BLEED_BOX.y}
    width={BLEED_BOX.w}
    height={BLEED_BOX.h}
    fill={colour}
    opacity={opacity}
  />
);
