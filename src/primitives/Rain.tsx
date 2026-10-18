import type { Box } from "../layout";
import { between, rng } from "../lib/rng";

export type RainProps = {
  area: Box;
  /** Dots per 10,000 px of area. */
  density: number;
  colour: string;
  seed: number;
  /** Distance a nominal dot has fallen, in px (1,400 px per second; see motion.fall). */
  fallen: number;
  /** Per-dot speed spread, as a fraction (the bible's 2%). */
  jitter?: number;
};

const DOT = 3;

/** Rain: 3 px dots. Black rain is the same in ink. */
export const Rain: React.FC<RainProps> = ({ area, density, colour, seed, fallen, jitter = 0.02 }) => {
  const next = rng(seed);
  const count = Math.round((area.w * area.h * density) / 10000);
  const span = area.h + DOT * 4;
  const dots = Array.from({ length: count }, () => {
    const x = between(next, area.x, area.x + area.w);
    const phase = between(next, 0, span);
    const speed = 1 + between(next, -jitter, jitter);
    const y = area.y - DOT * 2 + ((phase + fallen * speed) % span);
    return { x, y };
  });
  return (
    <g>
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={DOT / 2} fill={colour} />
      ))}
    </g>
  );
};
