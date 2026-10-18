/**
 * Where readable things go, and how big they are.
 *
 * Every readable element (DAY card, interstitial tally card, end card,
 * captions, the hidden detail, the handprint) takes its position from this
 * file, measured against a stage rectangle. Platform stages come from
 * src/platforms.ts; the numbers below reproduce the bible's figures for the
 * universal stage (card centre y 860, caption centre y 1440, horizon y 1130).
 */

export const FRAME = { width: 1080, height: 1920 } as const;
export const FPS = 30;

export type Box = { x: number; y: number; w: number; h: number };
export type Margins = { top: number; bottom: number; left: number; right: number };
export type Point = { x: number; y: number };

export const right = (b: Box): number => b.x + b.w;
export const bottom = (b: Box): number => b.y + b.h;
export const centreX = (b: Box): number => b.x + b.w / 2;
export const centreY = (b: Box): number => b.y + b.h / 2;

export const insetFrame = (m: Margins): Box => ({
  x: m.left,
  y: m.top,
  w: FRAME.width - m.left - m.right,
  h: FRAME.height - m.top - m.bottom,
});

/** True when the boxes share any area. Touching edges do not count. */
export const intersects = (a: Box, b: Box): boolean =>
  a.w > 0 &&
  a.h > 0 &&
  b.w > 0 &&
  b.h > 0 &&
  a.x < right(b) &&
  b.x < right(a) &&
  a.y < bottom(b) &&
  b.y < bottom(a);

export const contains = (outer: Box, inner: Box, tolerance = 0): boolean =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  right(inner) <= right(outer) + tolerance &&
  bottom(inner) <= bottom(outer) + tolerance;

export const intersection = (a: Box, b: Box): Box => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(right(a), right(b));
  const btm = Math.min(bottom(a), bottom(b));
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, btm - y) };
};

/** Scales a box about an origin, as the camera push does. */
export const scaleAbout = (b: Box, origin: Point, s: number): Box => ({
  x: origin.x + (b.x - origin.x) * s,
  y: origin.y + (b.y - origin.y) * s,
  w: b.w * s,
  h: b.h * s,
});

/**
 * Extra room kept between a platform's measured interface and its stage. The
 * values make the universal stage come out at the bible's x 72 to 948,
 * y 220 to 1540: the worst case of each edge plus this pad.
 */
export const STAGE_PAD: Margins = { top: 10, bottom: 20, left: 12, right: 12 };

/** The four interface bands a platform covers, in frame coordinates. */
export const blockedZones = (m: Margins): Box[] =>
  [
    { x: 0, y: 0, w: FRAME.width, h: m.top },
    { x: 0, y: FRAME.height - m.bottom, w: FRAME.width, h: m.bottom },
    { x: 0, y: 0, w: m.left, h: FRAME.height },
    { x: FRAME.width - m.right, y: 0, w: m.right, h: FRAME.height },
  ].filter((zone) => zone.w > 0 && zone.h > 0);

// ---------------------------------------------------------------------------
// Scenery constants that readable elements depend on
// ---------------------------------------------------------------------------

/** The horizon never moves. */
export const HORIZON_Y = 1130;

/** The road's vanishing point on the horizon. */
export const VANISHING_POINT: Point = { x: 540, y: HORIZON_Y };

/**
 * Figure construction at 1.0 scale (bible, "Figure construction"). An adult
 * is about 240 px tall: head 72, gap 8, torso 110, legs 50.
 */
export const FIGURE = {
  headRadius: 36,
  torsoWidth: 72,
  torsoHeight: 110,
  torsoRadius: 14,
  neckGap: 8,
  legLength: 50,
  armLength: 92,
  limbWidth: 8,
  mouthLength: 28,
  mouthWidth: 5,
  mouthDrop: 10,
  mouthBend: 8,
  height: 240,
} as const;

/** Bounding box of a standing figure whose feet are centred on `feet`. */
export const figureBox = (feet: Point, scale: number): Box => {
  const halfWidth = (FIGURE.torsoWidth / 2 + FIGURE.limbWidth) * scale;
  const height = FIGURE.height * scale;
  return {
    x: feet.x - halfWidth,
    y: feet.y - height,
    w: halfWidth * 2,
    h: height + (FIGURE.limbWidth / 2) * scale,
  };
};

// ---------------------------------------------------------------------------
// Scene-anchored readables
// ---------------------------------------------------------------------------
//
// The hidden detail and the handprint belong to scenery, and scenery is the
// same on every platform. They are therefore placed once, inside the
// universal stage (which every platform stage contains), and the scenes draw
// the scenery around them. tests/layout.test.ts proves they stay inside it at
// every push scale used.

export const HIDDEN_FIGURE = {
  /** Stands just off the road, right of the vanishing point. */
  feet: { x: VANISHING_POINT.x + 46, y: HORIZON_Y + 6 },
  /** 0.15 of an adult: 36 px tall, under the 40 px ceiling even at push 1.06. */
  scale: 0.15,
  maxHeight: 40,
} as const;

/** The cab door window in the night exterior. The cab is drawn around it. */
export const NIGHT_DOOR_WINDOW: Box = { x: 500, y: 912, w: 240, h: 156 };

/** Five short strokes and a smear, pressed on the door window from outside. */
export const PRINT_BOX: Box = { x: 572, y: 934, w: 96, h: 118 };

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------

export const CARD = {
  /** Card centre sits this far above the stage's vertical centre: 880 - 20 = 860 on the universal stage. */
  centreOffsetY: -20,
  dayFontSize: 132,
  /** Plex Mono advance width as a fraction of the font size. */
  advance: 0.6,
  dayLineHeight: 1.0,
  gap: 56,
  stroke: {
    length: 120,
    width: 12,
    spacing: 36,
    gateGap: 64,
    /** How far the gate's fifth (diagonal) stroke overhangs the first and fourth. */
    overhang: 18,
    /** How far a strike overhangs the mark it crosses. */
    strikeOverhang: 16,
  },
} as const;

export type StrokeGeom = {
  /** 0-based index of the mark this stroke represents. */
  mark: number;
  kind: "upright" | "gate";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type StrikeGeom = { mark: number; x1: number; y1: number; x2: number; y2: number };

export type CardGeometry = {
  centre: Point;
  dayBox: Box | null;
  dayFontSize: number;
  tallyBox: Box;
  strokes: StrokeGeom[];
  strikes: StrikeGeom[];
  /** Union of everything readable on the card. */
  box: Box;
};

const union = (boxes: Box[]): Box => {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const r = Math.max(...boxes.map(right));
  const btm = Math.max(...boxes.map(bottom));
  return { x, y, w: r - x, h: btm - y };
};

const strokeBox = (st: { x1: number; y1: number; x2: number; y2: number }): Box => ({
  x: Math.min(st.x1, st.x2) - CARD.stroke.width / 2,
  y: Math.min(st.y1, st.y2) - CARD.stroke.width / 2,
  w: Math.abs(st.x2 - st.x1) + CARD.stroke.width,
  h: Math.abs(st.y2 - st.y1) + CARD.stroke.width,
});

/** Strokes for `marks` tally marks, laid out from x = 0 at the given top. */
const tallyStrokes = (marks: number, top: number): StrokeGeom[] => {
  const s = CARD.stroke;
  const strokes: StrokeGeom[] = [];
  let x = 0;
  let gateStartX = 0;
  for (let mark = 0; mark < marks; mark++) {
    const inGate = mark % 5;
    if (inGate === 0) gateStartX = x;
    if (inGate < 4) {
      strokes.push({ mark, kind: "upright", x1: x, y1: top, x2: x, y2: top + s.length });
      x += s.spacing;
    } else {
      // The fifth stroke closes the gate: a diagonal through the four uprights.
      const lastUpright = gateStartX + 3 * s.spacing;
      strokes.push({
        mark,
        kind: "gate",
        x1: gateStartX - s.overhang,
        y1: top + s.length * 0.82,
        x2: lastUpright + s.overhang,
        y2: top + s.length * 0.18,
      });
      x = lastUpright + s.overhang + s.gateGap;
    }
  }
  return strokes;
};

/**
 * Card layout against a stage: an optional DAY line above a row of tally
 * marks in five-bar gates, centred as a group. Struck marks keep their place
 * with a diagonal through them.
 */
export const cardLayout = (
  stage: Box,
  opts: { dayText: string | null; marks: number; struck?: readonly number[] },
): CardGeometry => {
  const s = CARD.stroke;
  const centre = { x: centreX(stage), y: centreY(stage) + CARD.centreOffsetY };
  const hasDay = opts.dayText !== null;
  const dayHeight = hasDay ? CARD.dayFontSize * CARD.dayLineHeight : 0;
  const groupHeight = dayHeight + (hasDay ? CARD.gap : 0) + s.length;
  const top = centre.y - groupHeight / 2;

  const dayWidth = hasDay ? (opts.dayText ?? "").length * CARD.advance * CARD.dayFontSize : 0;
  const dayBox: Box | null = hasDay
    ? { x: centre.x - dayWidth / 2, y: top, w: dayWidth, h: dayHeight }
    : null;

  const tallyTop = top + dayHeight + (hasDay ? CARD.gap : 0);
  const raw = tallyStrokes(opts.marks, tallyTop);
  const rawBox = raw.length > 0 ? union(raw.map(strokeBox)) : { x: 0, y: tallyTop, w: 0, h: s.length };
  const shift = centre.x - centreX(rawBox);
  const strokes = raw.map((st) => ({ ...st, x1: st.x1 + shift, x2: st.x2 + shift }));

  const strikes: StrikeGeom[] = (opts.struck ?? []).flatMap((mark) => {
    const stroke = strokes.find((st) => st.mark === mark);
    if (stroke === undefined) return [];
    const midX = (stroke.x1 + stroke.x2) / 2;
    const half = s.length * 0.3;
    const reach = s.strikeOverhang + s.width;
    return [
      {
        mark,
        x1: midX - reach,
        y1: tallyTop + s.length / 2 + half,
        x2: midX + reach,
        y2: tallyTop + s.length / 2 - half,
      },
    ];
  });

  const tallyBox: Box =
    strokes.length > 0
      ? union([...strokes, ...strikes].map(strokeBox))
      : { x: centre.x - s.width / 2, y: tallyTop, w: s.width, h: s.length };
  const box = union(dayBox === null ? [tallyBox] : [dayBox, tallyBox]);
  return { centre, dayBox, dayFontSize: CARD.dayFontSize, tallyBox, strokes, strikes, box };
};

// ---------------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------------

export const CAPTION = {
  fontSize: 44,
  lineHeight: 1.25,
  maxRows: 2,
  advance: 0.6,
  /** Caption block centre sits this far above the stage bottom: 1540 - 100 = 1440 on the universal stage. */
  bottomOffset: 100,
  /** Horizontal breathing room inside the stage when working out row length. */
  sideInset: 24,
  /** Ink outline so captions survive the flash and the day sky. */
  outline: 3,
  radioOpacity: 0.6,
} as const;

/** Characters per caption row for a stage width. */
export const captionCharsPerRow = (stageWidth: number): number =>
  Math.floor((stageWidth - 2 * CAPTION.sideInset) / (CAPTION.fontSize * CAPTION.advance));

/** Box of a caption block of the given rows, centred on the stage's caption line. */
export const captionBox = (stage: Box, rows: readonly string[]): Box => {
  const longest = Math.max(1, ...rows.map((r) => r.length));
  const w = longest * CAPTION.fontSize * CAPTION.advance + 2 * CAPTION.outline;
  const h = rows.length * CAPTION.fontSize * CAPTION.lineHeight;
  const cy = bottom(stage) - CAPTION.bottomOffset;
  return { x: centreX(stage) - w / 2, y: cy - h / 2, w, h };
};
