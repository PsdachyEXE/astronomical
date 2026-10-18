/**
 * The loudness pass: integrated -16 LUFS, true peak at or below -1.5 dBTP,
 * AAC 192 kbps at 48 kHz. Gain is set from an EBU R128 measurement, peaks
 * are held by a limiter running at 4x oversampling (so it sees inter-sample
 * peaks), and the encoded AAC is measured again and corrected, because AAC
 * encoding can push true peak up a little.
 */
import { join } from "node:path";
import { runFfmpeg } from "./ffmpeg";

export const TARGET_LUFS = -16;
export const MAX_TRUE_PEAK = -1.5;
const LUFS_TOLERANCE = 0.4;

export type Loudness = { integrated: number; truePeak: number };

export const measureLoudness = (path: string): Loudness => {
  const log = runFfmpeg(["-nostats", "-i", path, "-vn", "-af", "ebur128=peak=true:framelog=quiet", "-f", "null", "-"]);
  const summary = log.slice(log.lastIndexOf("Summary:"));
  const i = /I:\s+(-?[\d.]+|-inf)\s+LUFS/.exec(summary);
  const tp = /True peak:\s+Peak:\s+(-?[\d.]+|-inf)\s+dBFS/.exec(summary);
  if (i === null || tp === null) throw new Error(`could not read loudness of ${path}:\n${summary}`);
  const num = (s: string | undefined) => (s === undefined || s === "-inf" ? -Infinity : Number(s));
  return { integrated: num(i[1]), truePeak: num(tp[1]) };
};

/** Normalises `input` audio to an AAC file at `output`; returns the measured result. */
export const loudnessPass = (input: string, output: string, workDir: string, audioKbps: number): Loudness & { gain: number; ceiling: number } => {
  const before = measureLoudness(input);
  if (!Number.isFinite(before.integrated)) throw new Error(`${input} is silent; nothing to normalise`);
  let gain = TARGET_LUFS - before.integrated;
  let ceiling = MAX_TRUE_PEAK - 1.0;
  let result: Loudness = before;
  for (let attempt = 0; attempt < 5; attempt++) {
    const limit = Math.pow(10, ceiling / 20).toFixed(4);
    const limited = join(workDir, "limited.wav");
    runFfmpeg([
      "-y", "-i", input, "-vn",
      "-af", `volume=${gain.toFixed(3)}dB,aresample=192000,alimiter=limit=${limit}:level=disabled:attack=1:release=80:asc=0,aresample=48000`,
      "-c:a", "pcm_f32le", limited,
    ]);
    runFfmpeg(["-y", "-i", limited, "-c:a", "aac", "-b:a", `${audioKbps}k`, "-ar", "48000", output]);
    result = measureLoudness(output);
    const off = TARGET_LUFS - result.integrated;
    const peakOk = result.truePeak <= MAX_TRUE_PEAK;
    if (Math.abs(off) <= LUFS_TOLERANCE && peakOk) break;
    gain += off;
    if (!peakOk) ceiling -= result.truePeak - MAX_TRUE_PEAK + 0.2;
  }
  return { ...result, gain, ceiling };
};
