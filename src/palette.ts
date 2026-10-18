/**
 * Every colour in TALLY. Nothing outside this file names a hex value.
 * Source: docs/bible.md, "Palette" and "Characters".
 */

export const PALETTE = {
  daySky: "#D98B4A",
  dayGround: "#7A3E1E",
  duskTop: "#6B2D5C",
  duskBottom: "#1A1040",
  night: "#0B1026",
  nightHorizon: "#16204A",
  flash: "#FFFFFF",
  text: "#F2EEE6",
  road: "#3A2A24",
  roadDash: "#C9B79C",
  ink: "#0A0A0A",
  /** The cue table's "Black." and the cut to black. Not in the bible's palette table; see DECISIONS.md. */
  black: "#000000",
} as const;

export type PaletteToken = keyof typeof PALETTE;

/** Debug overlay colours. Never in a deliverable frame. */
export const DEBUG = {
  zone: "#FF3B3B",
  stage: "#FFFFFF",
  pass: "#3BE36B",
  fail: "#FF2D2D",
  label: "#FFFFFF",
} as const;

/** After the flash, day colours are mixed 20% toward grey for the rest of the series. */
export const DRAIN = { toward: "#808080", amount: 0.2 } as const;

type Rgb = { r: number; g: number; b: number };

const toRgb = (hex: string): Rgb => {
  const value = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Not a six-digit hex colour: ${hex}`);
  }
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
};

const toHex = ({ r, g, b }: Rgb): string =>
  "#" +
  [r, g, b]
    .map((channel) =>
      Math.round(Math.min(255, Math.max(0, channel)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")
    .toUpperCase();

/** Linear mix in sRGB: t = 0 gives a, t = 1 gives b. */
export const mix = (a: string, b: string, t: number): string => {
  const ca = toRgb(a);
  const cb = toRgb(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
};

export const drained = (hex: string): string =>
  mix(hex, DRAIN.toward, DRAIN.amount);

const desaturate = (hex: string): string => {
  const { r, g, b } = toRgb(hex);
  const grey = 0.299 * r + 0.587 * g + 0.114 * b;
  return toHex({ r: grey, g: grey, b: grey });
};

const BONE = "#E8DCC4";

/** Colour is how the viewer tells the cast apart. Hollis's people share his ink. */
export const CHARACTER = {
  cal: BONE,
  june: "#B5651D",
  toby: "#3F7FBF",
  dog: "#8A8A8A",
  marcus: "#8B1E1E",
  priya: "#4E8F5C",
  benno: "#D9A520",
  lena: "#9CC3E6",
  hollis: PALETTE.ink,
  nine: PALETTE.ink,
  operator: desaturate(BONE),
} as const;

export type CharacterId = keyof typeof CHARACTER;

export const isCharacterId = (value: string): value is CharacterId =>
  Object.prototype.hasOwnProperty.call(CHARACTER, value);

/** A figure's mouth is ink, except on ink figures, where ink would vanish. */
export const mouthColour = (bodyColour: string): string =>
  bodyColour === PALETTE.ink ? PALETTE.nightHorizon : PALETTE.ink;

export type SkyKind = "day" | "drained" | "dusk" | "night" | "flash";

export type SkyColours = {
  top: string;
  bottom: string;
  ground: string;
  /** The horizon line is only drawn at night. */
  horizon: string | null;
};

/**
 * Sky and ground per time of day. Dusk is the only two-stop sky; every other
 * kind has top === bottom and renders flat.
 */
export const SKY: Record<SkyKind, SkyColours> = {
  day: {
    top: PALETTE.daySky,
    bottom: PALETTE.daySky,
    ground: PALETTE.dayGround,
    horizon: null,
  },
  drained: {
    top: drained(PALETTE.daySky),
    bottom: drained(PALETTE.daySky),
    ground: drained(PALETTE.dayGround),
    horizon: null,
  },
  dusk: {
    top: PALETTE.duskTop,
    bottom: PALETTE.duskBottom,
    ground: mix(drained(PALETTE.dayGround), PALETTE.night, 0.6),
    horizon: null,
  },
  night: {
    top: PALETTE.night,
    bottom: PALETTE.night,
    ground: PALETTE.night,
    horizon: PALETTE.nightHorizon,
  },
  flash: {
    top: PALETTE.flash,
    bottom: PALETTE.flash,
    ground: PALETTE.flash,
    horizon: null,
  },
};

/** Interpolates two skies; t = 0 is `from`, t = 1 is `to`. */
export const mixSky = (from: SkyKind, to: SkyKind, t: number): SkyColours => {
  const a = SKY[from];
  const b = SKY[to];
  const horizon =
    a.horizon !== null && b.horizon !== null
      ? mix(a.horizon, b.horizon, t)
      : t >= 1
        ? b.horizon
        : t <= 0
          ? a.horizon
          : null;
  return {
    top: mix(a.top, b.top, t),
    bottom: mix(a.bottom, b.bottom, t),
    ground: mix(a.ground, b.ground, t),
    horizon,
  };
};
