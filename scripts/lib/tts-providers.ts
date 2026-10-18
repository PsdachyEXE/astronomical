/**
 * TTS providers. Each turns one line into 48 kHz mono samples and, if it can,
 * word timestamps. The rest of the pipeline only ever sees the WAV files and
 * timing.json, so swapping the placeholder for a real provider changes
 * nothing downstream.
 */
import { VOICES, wordsOf, type VoiceId } from "../../src/voices";
import { fill, SR } from "./dsp";

export type SynthLine = { voice: VoiceId; text: string; pace: number };
export type SynthResult = {
  samples: Float32Array;
  sampleRate: number;
  /** Word timestamps in seconds from the clip start, if the provider measured them. */
  words: { text: string; start: number; end: number }[] | null;
};

export type TtsProvider = {
  name: string;
  synthesize: (line: SynthLine) => Promise<SynthResult>;
};

const TONE_SECONDS = 0.08;
const TONE_DB = -18;

/**
 * Placeholder mode: a silent clip whose length is the word count over the
 * voice's pace (2.17 words a second for the narrator, times any pace
 * direction), with a short tone at the start so line starts can be heard.
 * It has no word timestamps; the TTS step spaces words evenly and marks them
 * estimated.
 */
export const placeholderProvider: TtsProvider = {
  name: "placeholder",
  synthesize: async ({ voice, text, pace }) => {
    const seconds = wordsOf(text).length / (VOICES[voice].wordsPerSecond * pace);
    const n = Math.round(seconds * SR);
    const toneN = Math.min(n, Math.round(TONE_SECONDS * SR));
    const freq = VOICES[voice].radio ? 1320 : 880;
    const amp = Math.pow(10, TONE_DB / 20);
    const fadeN = Math.round(0.005 * SR);
    const samples = fill(n, (i, t) =>
      i < toneN ? amp * Math.sin(2 * Math.PI * freq * t) * Math.min(1, i / fadeN, (toneN - i) / fadeN) : 0,
    );
    return { samples, sampleRate: SR, words: null };
  },
};

export const PROVIDERS: Record<string, TtsProvider> = {
  placeholder: placeholderProvider,
};

export const providerFor = (name: string): TtsProvider => {
  const p = PROVIDERS[name];
  if (p === undefined) {
    throw new Error(
      `Unknown TTS provider "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}. ` +
        "A real provider is wired once one is chosen (see HANDOFF.md).",
    );
  }
  return p;
};
