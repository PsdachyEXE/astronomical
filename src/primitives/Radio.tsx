import type { Point } from "../layout";

export type RadioProps = {
  at: Point;
  body: string;
  light: string;
  /** 0 is off, 1 fully lit. */
  level: number;
  scale?: number;
};

const W = 180;
const H = 76;
const DOT = 9;

/** The cab radio: a small rectangle with one indicator dot. */
export const Radio: React.FC<RadioProps> = ({ at, body, light, level, scale = 1 }) => (
  <g transform={`translate(${at.x} ${at.y}) scale(${scale})`}>
    <rect x={0} y={0} width={W} height={H} rx={6} fill={body} />
    <rect x={18} y={H / 2 - 4} width={W - 70} height={8} fill={light} opacity={0.18} />
    <circle cx={W - 30} cy={H / 2} r={DOT} fill={light} opacity={0.15 + 0.85 * Math.max(0, Math.min(1, level))} />
  </g>
);
