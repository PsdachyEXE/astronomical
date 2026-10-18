/**
 * Scene models: what each scene's `state` may contain, how its times resolve
 * to absolute seconds, and a one-line description for the timeline table.
 * Pure data, no React, so the timeline builder can run in Node.
 *
 * Cues in the same shot inherit: each model's `resolve` receives the
 * previous cue's resolved state and keeps whatever the new cue leaves unset.
 * Resolved times are absolute seconds, so inherited moments stay put.
 */
import { z } from "zod";
import { TimeRefSchema, type TimeRef } from "../lib/episode";
import type { SkyKind } from "../palette";

const SKY_KINDS = ["day", "drained", "dusk", "night", "flash"] as const;

export type SkySpan = {
  from: SkyKind;
  to: SkyKind;
  start: number;
  end: number;
  mixFrom: number;
  mixTo: number;
};

const SkyRaw = z
  .object({
    from: z.enum(SKY_KINDS),
    to: z.enum(SKY_KINDS).optional(),
    /** Seconds the change takes; defaults to the whole cue. */
    over: z.number().positive().optional(),
    /** Portion of the from-to change covered by this cue, for changes spread over cues. */
    mix: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  })
  .strict();

/** Context a model resolves against. */
export type SceneContext = {
  cueId: string;
  start: number;
  end: number;
  shotStart: number;
  time: (ref: TimeRef) => number;
  /** Absolute start times of this cue's effects of one file. */
  sfxTimes: (file: string) => number[];
  /** Absolute word stamps of one of this cue's narration lines. */
  lineWords: (line: number) => { start: number; end: number }[];
  episode: { day: number; marksOpen: number; struckOpen: number[]; marksClose: number; struckClose: number[] };
};

const resolveSky = (raw: z.infer<typeof SkyRaw>, ctx: SceneContext): SkySpan => {
  const to = raw.to ?? raw.from;
  const mix = raw.mix ?? [0, 1];
  return {
    from: raw.from,
    to,
    start: ctx.start,
    end: raw.over === undefined ? ctx.end : ctx.start + raw.over,
    mixFrom: to === raw.from ? 0 : mix[0],
    mixTo: to === raw.from ? 0 : mix[1],
  };
};

const describeSky = (s: SkySpan): string =>
  s.from === s.to ? s.from : `${s.from}→${s.to}${s.mixFrom !== 0 || s.mixTo !== 1 ? ` (${s.mixFrom}–${s.mixTo})` : ""}`;

const t1 = (x: number): string => `${x.toFixed(1)} s`;

// ---------------------------------------------------------------------------

const DayCardRaw = z.object({}).strict();
export type DayCardState = { kind: "day-card"; dayText: string; marks: number; struck: number[]; drawStart: number };

const BlackSlitRaw = z.object({ slit: z.object({ at: TimeRefSchema }).strict().optional() }).strict();
export type BlackSlitState = { kind: "black-slit"; slitAt: number | null };

const RoadtrainRaw = z
  .object({
    sky: SkyRaw.optional(),
    cal: z.object({ pose: z.literal("under-trailer"), move: z.enum(["still", "idle"]) }).strict().optional(),
    flash: z.object({ at: TimeRefSchema, drain: z.number().positive().optional() }).strict().optional(),
    glass: z.object({ at: TimeRefSchema }).strict().optional(),
    jolt: z.object({ at: TimeRefSchema, duration: z.number().positive(), px: z.number().positive() }).strict().optional(),
    dust: z.object({ drift: z.number() }).strict().optional(),
  })
  .strict();
export type RoadtrainState = {
  kind: "roadtrain-side";
  sky: SkySpan;
  cal: { pose: "under-trailer"; move: "still" | "idle" } | null;
  flash: { at: number; drain: number | null } | null;
  glassAt: number | null;
  jolt: { at: number; duration: number; px: number } | null;
  dust: { drift: number; since: number } | null;
};

const HighwayRaw = z
  .object({
    sky: SkyRaw.optional(),
    cars: z.number().int().min(0).max(12).optional(),
    sun: z.boolean().optional(),
    smudge: z.boolean().optional(),
    cal: z.object({ move: z.enum(["walk", "still"]), until: TimeRefSchema.optional() }).strict().optional(),
    hidden: z.object({ from: TimeRefSchema }).strict().optional(),
    push: z.object({ from: z.number().min(1).max(1.06), to: z.number().min(1).max(1.06) }).strict().optional(),
  })
  .strict();
export type HighwayState = {
  kind: "highway-walk";
  sky: SkySpan;
  cars: number;
  sun: boolean;
  smudge: boolean;
  cal: { move: "walk" | "still"; since: number; until: number | null };
  hidden: { from: number } | null;
  push: { start: number; end: number; from: number; to: number } | null;
};

const SUN_POSITIONS = ["above", "touching", "below"] as const;
export type SunPosition = (typeof SUN_POSITIONS)[number];

const CabInteriorRaw = z
  .object({
    sky: SkyRaw.optional(),
    sun: z.object({ from: z.enum(SUN_POSITIONS), to: z.enum(SUN_POSITIONS) }).strict().optional(),
    radio: z
      .object({ on: TimeRefSchema.optional(), off: TimeRefSchema.optional(), pulse: z.number().int().min(0).optional() })
      .strict()
      .optional(),
  })
  .strict();
export type CabInteriorState = {
  kind: "cab-interior";
  sky: SkySpan;
  sun: { from: SunPosition; to: SunPosition; start: number; end: number };
  radio: { on: number | null; off: number | null; words: { start: number; end: number }[] };
};

const CabNightRaw = z
  .object({
    window: z.object({ lit: z.boolean().optional(), off: TimeRefSchema.optional() }).strict().optional(),
    cal: z
      .object({ pose: z.enum(["lying", "upright", "hidden"]).optional(), up: TimeRefSchema.optional() })
      .strict()
      .optional(),
    door: z.object({ shakeOn: z.string() }).strict().optional(),
    dawn: z.object({ from: TimeRefSchema }).strict().optional(),
    print: z.object({ from: TimeRefSchema }).strict().optional(),
    black: z.object({ at: TimeRefSchema }).strict().optional(),
  })
  .strict();
export type CabNightState = {
  kind: "cab-exterior-night";
  windowLit: boolean;
  windowOff: number | null;
  cal: { pose: "lying" | "upright" | "hidden"; upAt: number | null };
  shakes: number[];
  dawnFrom: number | null;
  printFrom: number | null;
  blackAt: number | null;
};

const EndCardRaw = z.object({}).strict();
export type EndCardState = { kind: "end-card"; marks: number; struck: number[]; fadeStart: number; fadeEnd: number };

/** Inserted by the timeline at a tally change; never written in an episode file. */
export type TallyCardState = {
  kind: "tally-card";
  marksBefore: number;
  struckBefore: number[];
  marks: number;
  struck: number[];
  drawMarks: number[];
  strikeMarks: number[];
  start: number;
};

export type SceneState =
  | DayCardState
  | BlackSlitState
  | RoadtrainState
  | HighwayState
  | CabInteriorState
  | CabNightState
  | EndCardState
  | TallyCardState;

export type SceneName = SceneState["kind"];

type Model<S extends SceneState> = {
  name: S["kind"];
  /** Validates and resolves raw state; `inherited` is the previous cue's state in the same shot. */
  resolve: (raw: unknown, ctx: SceneContext, inherited: S | null) => S;
  /** One line for the timeline table, naming only what happens inside the span. */
  describe: (s: S, span: Span) => string;
};

export type Span = { start: number; end: number };
const inSpan = (t: number | null, span: Span): t is number => t !== null && t >= span.start - 1e-6 && t < span.end - 1e-6;

const parse = <T,>(schema: z.ZodType<T>, raw: unknown, ctx: SceneContext, scene: string): T => {
  const r = schema.safeParse(raw);
  if (!r.success) {
    const why = r.error.issues.map((i) => `${i.path.join(".") || "state"}: ${i.message}`).join("; ");
    throw new Error(`${ctx.cueId}: invalid state for scene "${scene}": ${why}`);
  }
  return r.data;
};

const optTime = (ref: TimeRef | undefined, ctx: SceneContext): number | null =>
  ref === undefined ? null : ctx.time(ref);

const DAY_CARD: Model<DayCardState> = {
  name: "day-card",
  resolve: (raw, ctx) => {
    parse(DayCardRaw, raw, ctx, "day-card");
    return {
      kind: "day-card",
      dayText: `DAY ${ctx.episode.day}`,
      marks: ctx.episode.marksOpen,
      struck: ctx.episode.struckOpen,
      drawStart: ctx.start,
    };
  },
  describe: (s) => `Black. ${s.dayText}; ${s.marks} stroke(s) draw on`,
};

const BLACK_SLIT: Model<BlackSlitState> = {
  name: "black-slit",
  resolve: (raw, ctx, inh) => {
    const r = parse(BlackSlitRaw, raw, ctx, "black-slit");
    return { kind: "black-slit", slitAt: r.slit !== undefined ? ctx.time(r.slit.at) : (inh?.slitAt ?? null) };
  },
  describe: (s) => `Black.${s.slitAt === null ? "" : ` Slit of light from ${t1(s.slitAt)}`}`,
};

const ROADTRAIN: Model<RoadtrainState> = {
  name: "roadtrain-side",
  resolve: (raw, ctx, inh) => {
    const r = parse(RoadtrainRaw, raw, ctx, "roadtrain-side");
    const sky = r.sky !== undefined ? resolveSky(r.sky, ctx) : inh?.sky;
    if (sky === undefined) throw new Error(`${ctx.cueId}: roadtrain-side needs a sky on its first cue`);
    return {
      kind: "roadtrain-side",
      sky,
      cal: r.cal ?? inh?.cal ?? null,
      flash: r.flash !== undefined ? { at: ctx.time(r.flash.at), drain: r.flash.drain ?? null } : (inh?.flash ?? null),
      glassAt: r.glass !== undefined ? ctx.time(r.glass.at) : (inh?.glassAt ?? null),
      jolt:
        r.jolt !== undefined
          ? { at: ctx.time(r.jolt.at), duration: r.jolt.duration, px: r.jolt.px }
          : (inh?.jolt ?? null),
      dust: r.dust !== undefined ? { drift: r.dust.drift, since: ctx.start } : (inh?.dust ?? null),
    };
  },
  describe: (s, span) =>
    [
      `Wide side-on road train, ${describeSky(s.sky)}`,
      s.cal === null ? null : `Cal ${s.cal.pose} ${s.cal.move}`,
      s.flash === null || !inSpan(s.flash.at, span)
        ? null
        : s.flash.drain === null
          ? `cut to white ${t1(s.flash.at)}`
          : `white drains from ${t1(s.flash.at)} over ${s.flash.drain} s`,
      inSpan(s.glassAt, span) ? `glass falls ${t1(s.glassAt)}` : null,
      s.jolt !== null && inSpan(s.jolt.at, span) ? `frame jolts ${s.jolt.px} px ${t1(s.jolt.at)}` : null,
      s.dust === null ? null : `dust drifts ${s.dust.drift} px/s`,
    ]
      .filter((x) => x !== null)
      .join("; "),
};

const HIGHWAY: Model<HighwayState> = {
  name: "highway-walk",
  resolve: (raw, ctx, inh) => {
    const r = parse(HighwayRaw, raw, ctx, "highway-walk");
    const sky = r.sky !== undefined ? resolveSky(r.sky, ctx) : inh?.sky;
    if (sky === undefined) throw new Error(`${ctx.cueId}: highway-walk needs a sky on its first cue`);
    return {
      kind: "highway-walk",
      sky,
      cars: r.cars ?? inh?.cars ?? 7,
      sun: r.sun ?? inh?.sun ?? true,
      smudge: r.smudge ?? inh?.smudge ?? true,
      cal:
        r.cal !== undefined
          ? { move: r.cal.move, since: ctx.shotStart, until: optTime(r.cal.until, ctx) }
          : (inh?.cal ?? { move: "still", since: ctx.shotStart, until: null }),
      hidden: r.hidden !== undefined ? { from: ctx.time(r.hidden.from) } : (inh?.hidden ?? null),
      push: r.push !== undefined ? { start: ctx.start, end: ctx.end, from: r.push.from, to: r.push.to } : (inh?.push ?? null),
    };
  },
  describe: (s, span) =>
    [
      `Wide down the highway, ${describeSky(s.sky)}, ${s.cars} stopped cars`,
      `Cal ${s.cal.move}${s.cal.until === null ? "" : ` until ${t1(s.cal.until)}`}, dashes scroll`,
      s.hidden === null ? null : inSpan(s.hidden.from, span) ? `hidden detail from ${t1(s.hidden.from)}` : "hidden detail in frame",
      s.push === null || !inSpan(s.push.start, span) ? null : `push ${s.push.from.toFixed(2)}→${s.push.to.toFixed(2)}`,
    ]
      .filter((x) => x !== null)
      .join("; "),
};

const CAB_INTERIOR: Model<CabInteriorState> = {
  name: "cab-interior",
  resolve: (raw, ctx, inh) => {
    const r = parse(CabInteriorRaw, raw, ctx, "cab-interior");
    const sky = r.sky !== undefined ? resolveSky(r.sky, ctx) : inh?.sky;
    if (sky === undefined) throw new Error(`${ctx.cueId}: cab-interior needs a sky on its first cue`);
    const sun =
      r.sun !== undefined
        ? { from: r.sun.from, to: r.sun.to, start: ctx.start, end: ctx.end }
        : (inh?.sun ?? { from: "touching" as const, to: "touching" as const, start: ctx.start, end: ctx.end });
    const radio =
      r.radio !== undefined
        ? {
            on: optTime(r.radio.on, ctx) ?? inh?.radio.on ?? null,
            off: optTime(r.radio.off, ctx),
            words: r.radio.pulse === undefined ? [] : ctx.lineWords(r.radio.pulse),
          }
        : (inh?.radio ?? { on: null, off: null, words: [] });
    return { kind: "cab-interior", sky, sun, radio };
  },
  describe: (s, span) =>
    [
      `Cab interior, ${describeSky(s.sky)}, sun ${s.sun.from}${s.sun.to === s.sun.from ? "" : `→${s.sun.to}`}`,
      s.radio.on === null ? "radio dark" : inSpan(s.radio.on, span) ? `radio lights ${t1(s.radio.on)}` : "radio lit",
      s.radio.words.length > 0 ? "light pulses with the voice" : null,
      inSpan(s.radio.off, span) ? `radio off ${t1(s.radio.off)}` : null,
    ]
      .filter((x) => x !== null)
      .join("; "),
};

const CAB_NIGHT: Model<CabNightState> = {
  name: "cab-exterior-night",
  resolve: (raw, ctx, inh) => {
    const r = parse(CabNightRaw, raw, ctx, "cab-exterior-night");
    return {
      kind: "cab-exterior-night",
      windowLit: r.window?.lit ?? inh?.windowLit ?? true,
      windowOff: r.window?.off !== undefined ? ctx.time(r.window.off) : (inh?.windowOff ?? null),
      cal: {
        pose: r.cal?.pose ?? inh?.cal.pose ?? "lying",
        upAt: r.cal?.up !== undefined ? ctx.time(r.cal.up) : (inh?.cal.upAt ?? null),
      },
      shakes: r.door !== undefined ? ctx.sfxTimes(r.door.shakeOn) : (inh?.shakes ?? []),
      dawnFrom: r.dawn !== undefined ? ctx.time(r.dawn.from) : (inh?.dawnFrom ?? null),
      printFrom: r.print !== undefined ? ctx.time(r.print.from) : (inh?.printFrom ?? null),
      blackAt: r.black !== undefined ? ctx.time(r.black.at) : null,
    };
  },
  describe: (s, span) => {
    const lit = s.windowLit && (s.windowOff === null || s.windowOff >= span.start);
    const shakes = s.shakes.filter((t) => inSpan(t, span));
    return [
      `Exterior wide, night; window ${lit ? "lit" : "dark"}${inSpan(s.windowOff, span) ? `, goes out ${t1(s.windowOff)}` : ""}`,
      lit ? `Cal ${s.cal.upAt !== null && s.cal.upAt < span.start ? "upright" : s.cal.pose}` : null,
      inSpan(s.cal.upAt, span) ? `Cal jerks upright ${t1(s.cal.upAt)}` : null,
      shakes.length === 0 ? null : `door shakes ${shakes.map(t1).join(", ")}`,
      s.dawnFrom === null ? null : inSpan(s.dawnFrom, span) ? `dawn line creeps from ${t1(s.dawnFrom)}` : "dawn line creeps",
      s.printFrom === null ? null : inSpan(s.printFrom, span) ? `print on the door window from ${t1(s.printFrom)}` : "print on the door window",
      inSpan(s.blackAt, span) ? `cut to black ${t1(s.blackAt)}` : null,
    ]
      .filter((x) => x !== null)
      .join("; ");
  },
};

const END_CARD: Model<EndCardState> = {
  name: "end-card",
  resolve: (raw, ctx) => {
    parse(EndCardRaw, raw, ctx, "end-card");
    return {
      kind: "end-card",
      marks: ctx.episode.marksClose,
      struck: ctx.episode.struckClose,
      fadeStart: ctx.start,
      fadeEnd: ctx.end,
    };
  },
  describe: (s) => `Black. The tally (${s.marks} stroke(s)), centred, fades to nothing`,
};

const MODELS = {
  "day-card": DAY_CARD,
  "black-slit": BLACK_SLIT,
  "roadtrain-side": ROADTRAIN,
  "highway-walk": HIGHWAY,
  "cab-interior": CAB_INTERIOR,
  "cab-exterior-night": CAB_NIGHT,
  "end-card": END_CARD,
} as const;

export type AuthoredSceneName = keyof typeof MODELS;
export const AUTHORED_SCENES = Object.keys(MODELS) as AuthoredSceneName[];

export const isAuthoredScene = (name: string): name is AuthoredSceneName =>
  Object.prototype.hasOwnProperty.call(MODELS, name);

/** Resolves a cue's raw state through its scene's model. */
export const resolveScene = (
  scene: string,
  raw: unknown,
  ctx: SceneContext,
  inherited: SceneState | null,
): SceneState => {
  if (!isAuthoredScene(scene)) {
    throw new Error(`${ctx.cueId}: unknown scene "${scene}". Scenes: ${AUTHORED_SCENES.join(", ")}`);
  }
  const model = MODELS[scene] as Model<SceneState>;
  const inh = inherited !== null && inherited.kind === scene ? inherited : null;
  return model.resolve(raw, ctx, inh);
};

export const describeScene = (s: SceneState, span: Span): string => {
  if (s.kind === "tally-card") {
    const verb = s.strikeMarks.length > 0 ? "struck" : "drawn on";
    return `Black. Tally card: ${s.marksBefore - s.struckBefore.length} → ${s.marks - s.struck.length}, mark ${[...s.drawMarks, ...s.strikeMarks].map((m) => m + 1).join(", ")} ${verb}`;
  }
  const model = MODELS[s.kind] as Model<SceneState>;
  return model.describe(s, span);
};
