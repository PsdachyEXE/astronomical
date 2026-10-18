import { FRAME } from "../layout";
import { between, rng } from "../lib/rng";
import { BLEED } from "./frame";

export type DustProps = {
  horizonY: number;
  colour: string;
  /** Horizontal drift in px; positive moves right. */
  drift: number;
  seed: number;
  opacity?: number;
};

const BAND = 60;

/**
 * Dust: a 60 px band of day-sky at 30% sitting on the horizon. The band is
 * broken into lengths with gaps so a drift can be seen; it wraps around.
 */
export const Dust: React.FC<DustProps> = ({ horizonY, colour, drift, seed, opacity = 0.3 }) => {
  const next = rng(seed);
  const span = FRAME.width + 2 * BLEED;
  const pieces: { x: number; w: number }[] = [];
  let x = 0;
  while (x < span) {
    const w = between(next, 180, 520);
    const gap = between(next, 60, 220);
    pieces.push({ x, w: Math.min(w, span - x) });
    x += w + gap;
  }
  const offset = ((drift % span) + span) % span;
  return (
    <g opacity={opacity}>
      {pieces.flatMap((p, i) =>
        [0, -span].map((wrap) => (
          <rect
            key={`${i}:${wrap}`}
            x={-BLEED + ((p.x + offset) % span) + wrap}
            y={horizonY - BAND}
            width={p.w}
            height={BAND}
            fill={colour}
          />
        )),
      )}
    </g>
  );
};
