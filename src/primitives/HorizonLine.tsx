/** A line lying on the horizon, growing from one edge: the dawn. */
export const HorizonLine: React.FC<{
  horizonY: number;
  fromX: number;
  length: number;
  colour: string;
  width?: number;
  opacity?: number;
}> = ({ horizonY, fromX, length, colour, width = 4, opacity = 1 }) =>
  length <= 0 ? null : (
    <rect
      x={Math.min(fromX, fromX + length)}
      y={horizonY - width / 2}
      width={Math.abs(length)}
      height={width}
      fill={colour}
      opacity={opacity}
    />
  );
