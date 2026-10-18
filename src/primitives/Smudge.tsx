import type { Point } from "../layout";
import { between, rng } from "../lib/rng";

/** A dark smudge on the horizon: a cluster of ink circles. Darwin, Katherine. */
export const Smudge: React.FC<{
  centre: Point;
  width: number;
  height: number;
  colour: string;
  seed: number;
  opacity?: number;
}> = ({ centre, width, height, colour, seed, opacity = 0.45 }) => {
  const next = rng(seed);
  const blobs = Array.from({ length: 9 }, () => {
    const r = between(next, height * 0.35, height * 0.75);
    return {
      cx: centre.x + between(next, -width / 2 + r, width / 2 - r),
      cy: centre.y - between(next, 0, height - r),
      r,
    };
  });
  return (
    <g opacity={opacity}>
      {blobs.map((b, i) => (
        <circle key={i} cx={b.cx} cy={b.cy} r={b.r} fill={colour} />
      ))}
    </g>
  );
};
