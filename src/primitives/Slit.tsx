import { FRAME } from "../layout";
import { BLEED } from "./frame";

/** A thin horizontal slit of light across the frame. */
export const Slit: React.FC<{ y: number; height: number; colour: string; opacity?: number }> = ({
  y,
  height,
  colour,
  opacity = 1,
}) => (
  <rect x={-BLEED} y={y - height / 2} width={FRAME.width + 2 * BLEED} height={height} fill={colour} opacity={opacity} />
);
