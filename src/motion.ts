/**
 * Every animated value in TALLY comes from a function in this file. Scenes
 * and primitives draw; this file says where things are at a given moment.
 *
 * Figure moves (the bible's complete list): idle, walk, turn, flinch,
 * collapse, still, strike. Card strokes use drawOn. Environment moves are the
 * ones the Episode 1 cue table directs: the camera push, the blast jolt, the
 * door shake, dust drift, road scroll, falling glass and rain, sky
 * transitions, the radio light and the dawn line.
 *
 * Moves specified in frames take frames; moves specified in seconds take
 * seconds. Every input is time since the move started.
 */
import { FPS } from "./layout";
import { hashSeed, rng } from "./lib/rng";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const easeInOut = (x: number): number => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

/** What a figure move contributes to the Figure primitive. */
export type FigurePose = {
  lift: number;
  squash: number;
  growth: number;
  rotation: number;
  arms: readonly [number, number] | null;
  legs: readonly [number, number] | null;
};

export const REST: FigurePose = {
  lift: 0,
  squash: 1,
  growth: 1,
  rotation: 0,
  arms: null,
  legs: null,
};

// ---------------------------------------------------------------------------
// Figure moves
// ---------------------------------------------------------------------------

export const IDLE_PERIOD = 3;

/** idle: scale 1.00 to 1.02 and back, on a 3 s loop. */
export const idle = (seconds: number): FigurePose => ({
  ...REST,
  growth: 1 + 0.01 * (1 - Math.cos((2 * Math.PI * seconds) / IDLE_PERIOD)),
});

export const STEP_SECONDS = 0.8;
const WALK_BOB = 6;
const WALK_SWING = 25;
const ARM_REST = 8;

/**
 * walk: body bob ±6 px, limbs swing ±25°, 0.8 s per step. A foot lands at
 * every multiple of 0.8 s, which is when footstep sounds are placed.
 */
export const walk = (seconds: number): FigurePose => {
  const c = Math.cos((Math.PI * seconds) / STEP_SECONDS);
  const swing = WALK_SWING * c;
  return {
    ...REST,
    lift: WALK_BOB * (2 * Math.abs(c) - 1),
    legs: [swing, -swing],
    arms: [-ARM_REST - swing, ARM_REST + swing],
  };
};

/**
 * When a walk told to stop by `until` actually stops: the last moment at or
 * before it when the legs pass each other (mid-stride), so the figure settles
 * into its rest pose without a jump.
 */
export const walkStopsAt = (until: number): number => {
  const k = Math.floor((until - STEP_SECONDS / 2) / STEP_SECONDS + 1e-9);
  return Math.max(0, STEP_SECONDS / 2 + k * STEP_SECONDS);
};

/** Seconds into a walk at which foot contacts happen, within [0, until). */
export const stepTimes = (until: number): number[] => {
  const out: number[] = [];
  for (let k = 0; k * STEP_SECONDS < until - 1e-9; k++) out.push(k * STEP_SECONDS);
  return out;
};

export const TURN_FRAMES = 6;

/** turn: the mouth slides across the head over 6 frames. Positions are -1 (left) to +1 (right). */
export const turn = (frames: number, from: number, to: number): number =>
  from + (to - from) * easeInOut(frames / TURN_FRAMES);

export const FLINCH_FRAMES = 10;
const FLINCH_JUMP = 8;
const FLINCH_SQUASH = 0.92;

/** flinch: a 2-frame squash to 0.92 height, then an 8 px jump that lands by frame 10. */
export const flinch = (frames: number): FigurePose => {
  if (frames < 0 || frames >= FLINCH_FRAMES) return REST;
  if (frames < 2) return { ...REST, squash: FLINCH_SQUASH };
  const air = (frames - 2) / (FLINCH_FRAMES - 2);
  return { ...REST, lift: -FLINCH_JUMP * Math.sin(Math.PI * air) };
};

export const COLLAPSE_FRAMES = 18;

/**
 * collapse: rotate 90° and drop to the ground line over 18 frames. `drop` is
 * the height in px (at 1.0 scale) the body's pivot falls.
 */
export const collapse = (frames: number, drop: number, direction: -1 | 1 = 1): FigurePose => {
  const t = clamp01(frames / COLLAPSE_FRAMES);
  const fall = t * t;
  return { ...REST, rotation: direction * 90 * fall, lift: drop * fall };
};

/** still: nothing moves, idle off. */
export const still = (): FigurePose => REST;

export const STRIKE_FRAMES = 12;

/** strike: a diagonal drawn through a tally mark over 12 frames. Returns 0 to 1. */
export const strike = (frames: number): number => clamp01(frames / STRIKE_FRAMES);

export const DRAW_ON_FRAMES = 6;

/** Each tally stroke draws on over 6 frames. Returns 0 to 1. */
export const drawOn = (frames: number): number => clamp01(frames / DRAW_ON_FRAMES);

/** Draw-on progress for stroke k of a row that starts at `startFrame`, one stroke after another. */
export const drawOnSequence = (frame: number, startFrame: number, k: number): number =>
  drawOn(frame - startFrame - k * DRAW_ON_FRAMES);

// ---------------------------------------------------------------------------
// Camera and environment moves
// ---------------------------------------------------------------------------

/** The only camera move: a slow linear push between two scales across a span. */
export const push = (seconds: number, duration: number, from: number, to: number): number =>
  from + (to - from) * clamp01(duration > 0 ? seconds / duration : 1);

/** The whole frame jolts by up to `px` for `duration` seconds, a fresh offset each frame. */
export const jolt = (
  seconds: number,
  duration: number,
  px: number,
  seed: string,
): { dx: number; dy: number } => {
  if (seconds < 0 || seconds >= duration) return { dx: 0, dy: 0 };
  const frame = Math.floor(seconds * FPS + 1e-6);
  const next = rng(hashSeed(`${seed}:${frame}`));
  const sign = () => (next() < 0.5 ? -1 : 1);
  return { dx: sign() * Math.round(px * (0.5 + next() / 2)), dy: sign() * Math.round(px * (0.5 + next() / 2)) };
};

const SHAKE_PATTERN = [1, -1, 0.8, -0.6, 0.4, -0.2] as const;
export const SHAKE_FRAMES = SHAKE_PATTERN.length;

/** A door shaken from outside: a horizontal knock of `px` that settles over 6 frames. */
export const shake = (frames: number, px: number): number => {
  const i = Math.floor(frames);
  return i >= 0 && i < SHAKE_PATTERN.length ? px * SHAKE_PATTERN[i] : 0;
};

/** Sideways drift in px at a steady speed (dust at 20 px/s). */
export const drift = (seconds: number, pxPerSecond: number): number => seconds * pxPerSecond;

/** Road units travelled at a steady walking pace; the dashes scroll by this. */
export const scroll = (seconds: number, unitsPerSecond: number): number => seconds * unitsPerSecond;

export const RAIN_SPEED = 1400;
const GRAVITY = 2600;

/** Distance fallen: steady for rain (1,400 px/s), accelerating under gravity for glass. */
export const fall = (seconds: number, mode: "rain" | "gravity"): number =>
  seconds <= 0 ? 0 : mode === "rain" ? RAIN_SPEED * seconds : 0.5 * GRAVITY * seconds * seconds;

/** Progress of a colour transition (sky, the flash draining): 0 to 1 across a span. */
export const transition = (seconds: number, duration: number): number =>
  duration <= 0 ? (seconds >= 0 ? 1 : 0) : clamp01(seconds / duration);

/** Linear fade to nothing across a span, reaching zero `blackFrames` before the end. */
export const fadeOut = (seconds: number, duration: number, blackFrames = 0): number => {
  const span = duration - blackFrames / FPS;
  return span <= 0 ? 0 : 1 - clamp01(seconds / span);
};

/** Fade up from nothing across a span. */
export const fadeIn = (seconds: number, duration: number): number =>
  duration <= 0 ? 1 : clamp01(seconds / duration);

/** The radio light: full on a word, dim between words while the transmission runs. */
export const pulse = (
  seconds: number,
  words: readonly { start: number; end: number }[],
  dim = 0.4,
): number => (words.some((w) => seconds >= w.start && seconds < w.end) ? 1 : dim);

/** A line creeping along the horizon at a steady speed, in px. */
export const creep = (seconds: number, pxPerSecond: number): number => Math.max(0, seconds) * pxPerSecond;

/** A held state that switches at a moment and stays switched: lights out, a pose change. */
export const after = (seconds: number, at: number): boolean => seconds >= at;
