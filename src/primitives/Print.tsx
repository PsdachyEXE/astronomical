import type { Box } from "../layout";

/**
 * Five short vertical strokes above a smear, pressed on glass from outside.
 * Drawn in text colour at low opacity by the scene.
 */
export const Print: React.FC<{ box: Box; colour: string; opacity: number; readable?: string }> = ({
  box,
  colour,
  opacity,
  readable,
}) => {
  const stroke = box.w * 0.12;
  const smearTop = box.y + box.h * 0.52;
  const strokes = [
    { x: 0.1, top: 0.36, bottom: 0.62 },
    { x: 0.3, top: 0.06, bottom: 0.5 },
    { x: 0.5, top: 0.0, bottom: 0.5 },
    { x: 0.7, top: 0.04, bottom: 0.5 },
    { x: 0.89, top: 0.16, bottom: 0.52 },
  ];
  return (
    <g opacity={opacity} data-readable={readable}>
      {strokes.map((s, i) => (
        <line
          key={i}
          x1={box.x + box.w * s.x}
          y1={box.y + box.h * s.top + stroke / 2}
          x2={box.x + box.w * s.x}
          y2={box.y + box.h * s.bottom}
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      ))}
      <rect
        x={box.x + box.w * 0.18}
        y={smearTop}
        width={box.w * 0.7}
        height={box.y + box.h - smearTop}
        rx={box.w * 0.18}
        fill={colour}
      />
    </g>
  );
};
