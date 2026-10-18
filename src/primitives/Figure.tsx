import { FIGURE, type Point } from "../layout";
import { mouthColour } from "../palette";

export type Facing = "left" | "right" | "camera" | "away";

/** Where the mouth sits across the head, as a fraction of the head radius. */
export const MOUTH_POSITION: Record<Exclude<Facing, "away">, number> = {
  left: -0.56,
  camera: 0,
  right: 0.56,
};

export type FigureProps = {
  /** Centre point between the two legs where they meet the ground. */
  base: Point;
  colour: string;
  scale: number;
  facing: Facing;
  /** -1 frown, 0 flat, +1 smile. */
  mouthCurve: number;
  /** Overrides the facing position while a turn is in progress (-1 to +1 of MOUTH_POSITION.right). */
  mouthAt?: number | null;
  /** Arm angles in degrees from hanging straight down; positive swings toward +x. [left, right]. */
  arms?: readonly [number, number];
  /** Leg angles in degrees from straight down; positive swings toward +x. [left, right]. */
  legs?: readonly [number, number];
  /** Whole-body rotation in degrees about the base point. */
  rotation?: number;
  /** Vertical offset in px at 1.0 scale (bob, flinch jump). Positive is down. */
  lift?: number;
  /** Vertical squash about the base (1 = none). */
  squash?: number;
  /** Uniform growth (idle breathing), 1 = none. */
  growth?: number;
  opacity?: number;
  /** Marks the figure as a readable element for the safe-zone check. */
  readable?: string;
};

const deg = (d: number): number => (d * Math.PI) / 180;

/**
 * A person: circle head, rounded-rectangle torso, four stroked lines, and a
 * single curved stroke for a mouth. No other facial features, ever. Facing is
 * read from where the mouth sits; facing away hides it.
 */
export const Figure: React.FC<FigureProps> = ({
  base,
  colour,
  scale,
  facing,
  mouthCurve,
  mouthAt = null,
  arms = [-8, 8],
  legs = [0, 0],
  rotation = 0,
  lift = 0,
  squash = 1,
  growth = 1,
  opacity = 1,
  readable,
}) => {
  const f = FIGURE;
  const torsoBottom = -f.legLength;
  const torsoTop = torsoBottom - f.torsoHeight;
  const headY = torsoTop - f.neckGap - f.headRadius;
  const hipX = f.torsoWidth / 2 - f.limbWidth / 2;
  const shoulderX = f.torsoWidth / 2;
  const shoulderY = torsoTop + f.limbWidth;

  const limb = (x: number, y: number, length: number, angle: number) => ({
    x1: x,
    y1: y,
    x2: x + Math.sin(deg(angle)) * length,
    y2: y + Math.cos(deg(angle)) * length,
  });

  const leftArm = limb(-shoulderX, shoulderY, f.armLength, arms[0]);
  const rightArm = limb(shoulderX, shoulderY, f.armLength, arms[1]);
  const leftLeg = limb(-hipX, torsoBottom, f.legLength, legs[0]);
  const rightLeg = limb(hipX, torsoBottom, f.legLength, legs[1]);

  const mouthFraction =
    mouthAt !== null ? mouthAt * MOUTH_POSITION.right : facing === "away" ? null : MOUTH_POSITION[facing];
  const mouthX = mouthFraction === null ? 0 : mouthFraction * f.headRadius;
  const mouthY = headY + f.mouthDrop;
  const half = f.mouthLength / 2;
  const bend = Math.max(-1, Math.min(1, mouthCurve)) * f.mouthBend * 2;

  const s = scale * growth;
  const transform = [
    `translate(${base.x} ${base.y})`,
    `rotate(${rotation})`,
    `scale(${s} ${s * squash})`,
    `translate(0 ${lift})`,
  ].join(" ");

  return (
    <g transform={transform} opacity={opacity} data-readable={readable}>
      {[leftLeg, rightLeg, leftArm, rightArm].map((l, i) => (
        <line
          key={i}
          {...l}
          stroke={colour}
          strokeWidth={f.limbWidth}
          strokeLinecap="round"
        />
      ))}
      <rect
        x={-f.torsoWidth / 2}
        y={torsoTop}
        width={f.torsoWidth}
        height={f.torsoHeight}
        rx={f.torsoRadius}
        fill={colour}
      />
      <circle cx={0} cy={headY} r={f.headRadius} fill={colour} />
      {mouthFraction === null ? null : (
        <path
          d={`M ${mouthX - half} ${mouthY} Q ${mouthX} ${mouthY + bend} ${mouthX + half} ${mouthY}`}
          fill="none"
          stroke={mouthColour(colour)}
          strokeWidth={f.mouthWidth}
          strokeLinecap="round"
        />
      )}
    </g>
  );
};
