import type { CardGeometry } from "../layout";
import { FONT_FAMILY } from "../fonts";
import { CARD } from "../layout";
import { PALETTE } from "../palette";

export type CardProps = {
  geometry: CardGeometry;
  dayText: string | null;
  /** 0 to 1 per mark index: how much of that stroke is drawn on. */
  strokeProgress: (mark: number) => number;
  /** 0 to 1 per struck mark index: how much of the strike is drawn. */
  strikeProgress: (mark: number) => number;
  opacity?: number;
  readable?: string;
};

const partial = (x1: number, y1: number, x2: number, y2: number, p: number) => ({
  x1,
  y1,
  x2: x1 + (x2 - x1) * p,
  y2: y1 + (y2 - y1) * p,
});

/**
 * DAY n in the monospace display face, centred, with the tally beneath it in
 * five-bar gates. Strokes are lines drawn on, never typed characters. A struck
 * mark keeps its place with a diagonal through it.
 */
export const Card: React.FC<CardProps> = ({
  geometry,
  dayText,
  strokeProgress,
  strikeProgress,
  opacity = 1,
  readable,
}) => {
  const { dayBox } = geometry;
  return (
    <g opacity={opacity} data-readable={readable}>
      {dayText !== null && dayBox !== null ? (
        <text
          x={dayBox.x + dayBox.w / 2}
          y={dayBox.y + dayBox.h / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily={FONT_FAMILY}
          fontWeight={600}
          fontSize={geometry.dayFontSize}
          fill={PALETTE.text}
        >
          {dayText}
        </text>
      ) : null}
      {geometry.strokes.map((st) => {
        const p = Math.max(0, Math.min(1, strokeProgress(st.mark)));
        if (p <= 0) return null;
        return (
          <line
            key={`s${st.mark}`}
            {...partial(st.x1, st.y1, st.x2, st.y2, p)}
            stroke={PALETTE.text}
            strokeWidth={CARD.stroke.width}
            strokeLinecap="round"
          />
        );
      })}
      {geometry.strikes.map((st) => {
        const p = Math.max(0, Math.min(1, strikeProgress(st.mark)));
        if (p <= 0) return null;
        return (
          <line
            key={`x${st.mark}`}
            {...partial(st.x1, st.y1, st.x2, st.y2, p)}
            stroke={PALETTE.text}
            strokeWidth={CARD.stroke.width}
            strokeLinecap="round"
          />
        );
      })}
    </g>
  );
};
