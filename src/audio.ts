/**
 * The audio envelope: level in dB ramping from gainFrom to gainTo across the
 * instance, times linear fades in and out. Used per frame by AudioLayer.
 */
import type { AudioEvent } from "./lib/timeline";

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const dbToGain = (db: number): number => Math.pow(10, db / 20);

/** Linear gain of an audio event at absolute time t (seconds). */
export const volumeAt = (ev: AudioEvent, t: number): number => {
  const span = ev.envEnd - ev.envStart;
  const k = span > 0 ? clamp01((t - ev.envStart) / span) : 1;
  const db = ev.gainFrom + (ev.gainTo - ev.gainFrom) * k;
  const fadeIn = ev.fadeIn > 0 ? clamp01((t - ev.envStart) / ev.fadeIn) : 1;
  const fadeOut = ev.fadeOut > 0 ? clamp01((ev.envEnd - t) / ev.fadeOut) : 1;
  return dbToGain(db) * fadeIn * fadeOut;
};
