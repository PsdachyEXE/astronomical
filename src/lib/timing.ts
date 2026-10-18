/**
 * timing.json: what the TTS step measured. One entry per narration line,
 * keyed "<cue>#<line>". The timeline reads only this file and the clips; it
 * never asks how they were made. `wordTiming` says whether the word stamps
 * were measured (provider timestamps or forced alignment) or estimated (even
 * spacing), because a trigger may only trust measured stamps.
 */
import { z } from "zod";
import { hashSeed } from "./rng";

export const WordSchema = z.object({ text: z.string(), start: z.number(), end: z.number() }).strict();
export type Word = z.infer<typeof WordSchema>;

export const ClipTimingSchema = z
  .object({
    file: z.string(),
    voice: z.string(),
    text: z.string(),
    pace: z.number(),
    /** Measured from the audio file, in seconds. */
    duration: z.number().positive(),
    words: z.array(WordSchema),
    wordTiming: z.enum(["measured", "estimated"]),
    /** Hash of voice, pace and text, so a stale clip is caught. */
    hash: z.string(),
  })
  .strict();
export type ClipTiming = z.infer<typeof ClipTimingSchema>;

export const TimingSchema = z
  .object({
    episode: z.string(),
    provider: z.string(),
    clips: z.record(z.string(), ClipTimingSchema),
  })
  .strict();
export type Timing = z.infer<typeof TimingSchema>;

export const clipKey = (cueId: string, line: number): string => `${cueId}#${line}`;

export const clipHash = (voice: string, text: string, pace: number): string =>
  hashSeed(`${voice}|${pace.toFixed(3)}|${text}`).toString(16).padStart(8, "0");

/** Evenly spaced word stamps across a clip, for clips with no measured timings. */
export const evenWords = (words: readonly string[], duration: number): Word[] => {
  const n = Math.max(1, words.length);
  return words.map((text, i) => ({ text, start: (i * duration) / n, end: ((i + 1) * duration) / n }));
};
