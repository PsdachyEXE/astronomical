import type { Point } from "../layout";

export const CAR = { w: 180, h: 96, door: 54 } as const;

/** A stopped car seen from behind: a rectangle, with one door line hanging open. */
export const Car: React.FC<{
  base: Point;
  scale: number;
  colour: string;
  doorColour: string;
  doorSide: -1 | 1;
}> = ({ base, scale, colour, doorColour, doorSide }) => {
  const half = CAR.w / 2;
  return (
    <g transform={`translate(${base.x} ${base.y}) scale(${scale})`}>
      <rect x={-half} y={-CAR.h} width={CAR.w} height={CAR.h} fill={colour} />
      <line
        x1={doorSide * half}
        y1={-CAR.h * 0.85}
        x2={doorSide * (half + CAR.door)}
        y2={-CAR.h * 0.2}
        stroke={doorColour}
        strokeWidth={8}
        strokeLinecap="round"
      />
    </g>
  );
};
