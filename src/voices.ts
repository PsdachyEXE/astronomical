/**
 * The three voices. `wordsPerSecond` is the voice's natural pace: the
 * placeholder TTS uses it to size silent clips, and the scaffolder uses it to
 * turn a cue table's timings into pace directions. A real provider ignores it
 * and is measured instead.
 */
export type VoiceId = "cal" | "authority" | "hollis";

export type VoiceConfig = {
  id: VoiceId;
  label: string;
  /** Radio voices are band-passed, get a static bed and show at 60% in captions. */
  radio: boolean;
  wordsPerSecond: number;
};

export const VOICES: Record<VoiceId, VoiceConfig> = {
  // 2.17 words per second (130 a minute): the bible's narrator pace and the prompt's placeholder rate.
  cal: { id: "cal", label: "Cal (narrator)", radio: false, wordsPerSecond: 2.17 },
  // About 165 a minute: flat, clipped, automated.
  authority: { id: "authority", label: "Northern Recovery Authority loop", radio: true, wordsPerSecond: 2.75 },
  // Calm; no pace given in the bible, so the narrator's.
  hollis: { id: "hollis", label: "Hollis", radio: true, wordsPerSecond: 2.17 },
};

export const isVoiceId = (value: string): value is VoiceId =>
  Object.prototype.hasOwnProperty.call(VOICES, value);

/** Words as the pipeline counts them: whitespace-separated tokens with a letter or digit. */
export const wordsOf = (text: string): string[] =>
  text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));

/** A word with surrounding punctuation stripped and case folded, for matching triggers. */
export const normaliseWord = (word: string): string =>
  word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/[’]/g, "'");

/** Seconds a line takes at a voice's natural pace times a pace direction. */
export const estimateSeconds = (text: string, voice: VoiceId, pace = 1): number =>
  wordsOf(text).length / (VOICES[voice].wordsPerSecond * pace);
