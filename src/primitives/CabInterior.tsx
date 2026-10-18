import type { Box } from "../layout";
import { BLEED_BOX } from "./frame";

/** Inside the cab: everything dark except the windscreen. */
export const CabInterior: React.FC<{ windscreen: Box; colour: string; radius?: number }> = ({
  windscreen: w,
  colour,
  radius = 28,
}) => {
  const outer = `M ${BLEED_BOX.x} ${BLEED_BOX.y} h ${BLEED_BOX.w} v ${BLEED_BOX.h} h ${-BLEED_BOX.w} Z`;
  const r = radius;
  const inner =
    `M ${w.x + r} ${w.y} H ${w.x + w.w - r} Q ${w.x + w.w} ${w.y} ${w.x + w.w} ${w.y + r} ` +
    `V ${w.y + w.h - r} Q ${w.x + w.w} ${w.y + w.h} ${w.x + w.w - r} ${w.y + w.h} ` +
    `H ${w.x + r} Q ${w.x} ${w.y + w.h} ${w.x} ${w.y + w.h - r} V ${w.y + r} Q ${w.x} ${w.y} ${w.x + r} ${w.y} Z`;
  return <path d={`${outer} ${inner}`} fill={colour} fillRule="evenodd" />;
};
