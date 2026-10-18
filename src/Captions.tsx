import { CAPTION, captionBox, centreX, FRAME, type Box } from "./layout";
import { FONT_FAMILY } from "./fonts";
import type { CaptionPage } from "./lib/captions";
import { PALETTE } from "./palette";
import { READABLE } from "./scenes/common";

export const pageAt = (pages: readonly CaptionPage[], t: number): CaptionPage | null =>
  pages.find((p) => t >= p.start && t < p.end) ?? null;

/**
 * Burned-in captions: one caption line of at most two rows in the monospace
 * face at 44 px, centred on the stage's caption line (y 1440 on the universal
 * stage), timed from the word stamps. Radio lines at 60% opacity. An ink
 * outline keeps them legible over the flash and the day sky.
 */
export const Captions: React.FC<{ pages: readonly CaptionPage[]; t: number; stage: Box }> = ({ pages, t, stage }) => {
  const page = pageAt(pages, t);
  if (page === null) return null;
  const box = captionBox(stage, page.rows);
  const rowHeight = CAPTION.fontSize * CAPTION.lineHeight;
  return (
    <svg
      width={FRAME.width}
      height={FRAME.height}
      viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
      style={{ position: "absolute", left: 0, top: 0 }}
    >
      <g data-readable={READABLE.captions} opacity={page.radio ? CAPTION.radioOpacity : 1}>
        {page.rows.map((row, i) => (
          <text
            key={i}
            x={centreX(box)}
            y={box.y + rowHeight * (i + 0.5)}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={FONT_FAMILY}
            fontWeight={400}
            fontSize={CAPTION.fontSize}
            fill={PALETTE.text}
            stroke={PALETTE.ink}
            strokeWidth={CAPTION.outline * 2}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {row}
          </text>
        ))}
      </g>
    </svg>
  );
};
