/**
 * The episode file: one JSON per episode, the renderer's single source of
 * truth. The markdown cue table in docs/ is the human copy.
 *
 * Times inside a cue are seconds from the cue's start, or a time reference
 * (see timeref.ts) that pins a moment to something measured: a word, the end
 * of a line, an effect.
 */
import { z } from "zod";
import { TIME_REF_PATTERN } from "./timeref";

export const PARTS = ["card", "situation", "escalation", "climax", "sting", "end"] as const;
export type Part = (typeof PARTS)[number];

export const TimeRefSchema = z.union([
  z.number(),
  z.string().regex(TIME_REF_PATTERN, "time reference like 2.0, \"end\", \"trigger:flash+0.2\", \"line:1:end\" or \"sfx:bang#0\""),
]);
export type TimeRef = z.infer<typeof TimeRefSchema>;

export const LineSchema = z
  .object({
    voice: z.string(),
    text: z.string().min(1),
    /** Seconds of silence before this line: from the cue start for the first line, from the previous clip's end after that. */
    pauseBefore: z.number().min(0),
    /** Pace direction for the voice, 1 = its natural pace. Passed to the provider as its speaking rate. */
    pace: z.number().min(0.5).max(2).optional(),
  })
  .strict();
export type Line = z.infer<typeof LineSchema>;

export const TriggerSchema = z
  .object({
    id: z.string().regex(/^[\w-]+$/),
    /** Which narration line of the cue holds the word. */
    line: z.number().int().min(0).default(0),
    word: z.string().min(1),
    /** Which occurrence of the word, counting from 1. */
    occurrence: z.number().int().min(1).default(1),
    /** Fraction of the clip to fire at when the clip has no measured word timings. */
    fallback: z.number().min(0).max(1),
    /** The cue lasts at least this long after the trigger fires. */
    hold: z.number().min(0).default(0),
  })
  .strict();
export type Trigger = z.infer<typeof TriggerSchema>;

export const SfxEntrySchema = z
  .object({
    /** An effect from the library (src/sfx.ts). */
    file: z.string().optional(),
    /** Or a narration clip played again as an effect, by "<cue>#<line>". */
    clip: z.string().regex(/^[\w-]+#\d+$/).optional(),
    at: TimeRefSchema.default(0),
    /** When it stops. Defaults to the file's natural end, or the cue's end for loops. */
    until: TimeRefSchema.optional(),
    /** Repeat every n seconds on the shot's grid (footsteps). */
    every: z.number().positive().optional(),
    /** Level in dB at the end of the entry (constant unless gainFrom is set). */
    gain: z.number().max(6).default(0),
    /** Level in dB at the start; ramps in dB to `gain`. */
    gainFrom: z.number().max(6).optional(),
    fadeIn: z.number().min(0).optional(),
    fadeOut: z.number().min(0).optional(),
    /** Seeded pitch variance, as a fraction (0.02 for "2% pitch variance"). */
    pitch: z.number().min(0).max(0.1).optional(),
    /** No narration may sound within this many seconds of the effect. */
    clear: z.number().min(0).optional(),
  })
  .strict()
  .refine((s) => (s.file === undefined) !== (s.clip === undefined), {
    message: "an sfx entry needs exactly one of `file` or `clip`",
  });
export type SfxEntry = z.infer<typeof SfxEntrySchema>;

export const CueSchema = z
  .object({
    id: z.string().regex(/^[\w-]+$/),
    part: z.enum(PARTS).optional(),
    scene: z.string(),
    /** Force a new shot even when the scene matches the previous cue's. */
    cut: z.boolean().default(false),
    state: z.record(z.string(), z.unknown()).default({}),
    narration: z.array(LineSchema).default([]),
    triggers: z.array(TriggerSchema).default([]),
    sfx: z.array(SfxEntrySchema).default([]),
    minDuration: z.number().positive(),
    holdAfter: z.number().min(0).default(0),
    notes: z.string().optional(),
  })
  .strict();
export type Cue = z.infer<typeof CueSchema>;

export const TallySchema = z
  .object({
    open: z.number().int().min(0),
    close: z.number().int().min(0),
    /** Marks already struck when the episode opens, by 0-based position. */
    struck: z.array(z.number().int().min(0)).default([]),
    /** A change inserts a 1.2-second tally card immediately before the named cue. */
    changes: z
      .array(z.object({ cue: z.string(), to: z.number().int().min(0) }).strict())
      .default([]),
  })
  .strict();

export const EpisodeSchema = z
  .object({
    episode: z.number().int().min(0),
    day: z.number().int().min(0),
    tally: TallySchema,
    voices: z.object({ narrator: z.string(), radio: z.string() }).strict(),
    /** The one thing in frame the narration never mentions; these words must never appear in captions or post text. */
    hidden: z
      .object({ cue: z.string(), words: z.array(z.string().min(1)).min(1) })
      .strict()
      .optional(),
    post: z.object({ hook: z.string().optional() }).strict().default({}),
    cues: z.array(CueSchema).min(1),
  })
  .strict();
export type Episode = z.infer<typeof EpisodeSchema>;
export type EpisodeInput = z.input<typeof EpisodeSchema>;

/** Parses an episode, throwing one readable error listing every problem. */
export const parseEpisode = (data: unknown, label: string): Episode => {
  const result = EpisodeSchema.safeParse(data);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`${label} is not a valid episode:\n${problems}`);
  }
  const ids = new Set<string>();
  for (const cue of result.data.cues) {
    if (ids.has(cue.id)) throw new Error(`${label}: duplicate cue id ${cue.id}`);
    ids.add(cue.id);
  }
  return result.data;
};
