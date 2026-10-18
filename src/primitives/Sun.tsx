import type { Point } from "../layout";

/** A dull disc. Clip it with the horizon to set it. */
export const Sun: React.FC<{ centre: Point; radius: number; colour: string; opacity?: number }> = ({
  centre,
  radius,
  colour,
  opacity = 1,
}) => <circle cx={centre.x} cy={centre.y} r={radius} fill={colour} opacity={opacity} />;
