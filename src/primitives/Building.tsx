import type { Point } from "../layout";

/** A building: a rectangle, one darker door, an optional triangle roof. */
export const Building: React.FC<{
  base: Point;
  w: number;
  h: number;
  colour: string;
  doorColour: string;
  roof?: string | null;
  doorAt?: number;
}> = ({ base, w, h, colour, doorColour, roof = null, doorAt = 0.3 }) => {
  const doorW = Math.min(70, w * 0.22);
  const doorH = Math.min(130, h * 0.6);
  return (
    <g>
      {roof === null ? null : (
        <polygon
          points={`${base.x - 12},${base.y - h} ${base.x + w / 2},${base.y - h - h * 0.35} ${base.x + w + 12},${base.y - h}`}
          fill={roof}
        />
      )}
      <rect x={base.x} y={base.y - h} width={w} height={h} fill={colour} />
      <rect x={base.x + w * doorAt} y={base.y - doorH} width={doorW} height={doorH} fill={doorColour} />
    </g>
  );
};

/** A termite mound: a triangle. */
export const Mound: React.FC<{ base: Point; w: number; h: number; colour: string }> = ({ base, w, h, colour }) => (
  <polygon points={`${base.x - w / 2},${base.y} ${base.x},${base.y - h} ${base.x + w / 2},${base.y}`} fill={colour} />
);
