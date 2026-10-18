import type { Box } from "../layout";
import { between, rng } from "../lib/rng";

export type FragmentsProps = {
  /** Where the pieces start. */
  source: Box;
  count: number;
  /** Square edge in px: glass is 6, debris 10 to 18. */
  size: readonly [number, number];
  colour: string;
  seed: number;
  /** Distance a nominal piece has fallen, in px (see motion.fall). */
  fallen: number;
  /** Pieces stop here. */
  floorY: number;
  /** Sideways spread in px at the end of the fall. */
  spread?: number;
  opacity?: number;
};

/** Small squares that drop from a source and settle on the floor. */
export const Fragments: React.FC<FragmentsProps> = ({
  source,
  count,
  size,
  colour,
  seed,
  fallen,
  floorY,
  spread = 30,
  opacity = 1,
}) => {
  const next = rng(seed);
  const pieces = Array.from({ length: count }, () => {
    const s = Math.round(between(next, size[0], size[1]));
    const x0 = between(next, source.x, source.x + source.w);
    const y0 = between(next, source.y, source.y + source.h);
    const speed = between(next, 0.8, 1.2);
    const side = between(next, -1, 1);
    const drop = Math.min(fallen * speed, floorY - s - y0);
    const progress = floorY - s - y0 > 0 ? drop / (floorY - s - y0) : 1;
    return { s, x: x0 + side * spread * progress, y: y0 + Math.max(0, drop) };
  });
  return (
    <g opacity={opacity}>
      {pieces.map((p, i) => (
        <rect key={i} x={p.x} y={p.y} width={p.s} height={p.s} fill={colour} />
      ))}
    </g>
  );
};
