/** Reads rendered audio back for checks: onsets of loud events, levels over time. */
import { spawnSync } from "node:child_process";

export const SAMPLE_RATE = 48000;

/** Decodes any media file's first audio stream to mono float samples at 48 kHz. */
export const decodeMono = (path: string): Float32Array => {
  const res = spawnSync(
    "ffmpeg",
    // An explicit average, not ffmpeg's default downmix, which adds 3 dB to identical channels.
    ["-hide_banner", "-nostdin", "-v", "error", "-i", path, "-vn", "-af", "pan=mono|c0=0.5*c0+0.5*c1", "-ar", String(SAMPLE_RATE), "-f", "f32le", "-"],
    { maxBuffer: 1024 * 1024 * 1024 },
  );
  if (res.status !== 0) throw new Error(`ffmpeg could not decode ${path}: ${res.stderr.toString()}`);
  const buf = res.stdout;
  return new Float32Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 4));
};

/** Peak absolute level per window, in dBFS. */
export const peakEnvelope = (samples: Float32Array, windowSeconds = 0.01): number[] => {
  const n = Math.max(1, Math.round(windowSeconds * SAMPLE_RATE));
  const out: number[] = [];
  for (let i = 0; i < samples.length; i += n) {
    let p = 0;
    for (let j = i; j < Math.min(samples.length, i + n); j++) p = Math.max(p, Math.abs(samples[j] ?? 0));
    out.push(p > 0 ? 20 * Math.log10(p) : -120);
  }
  return out;
};

/**
 * Times (seconds) where the level jumps by `riseDb` above the previous
 * `lookback` seconds' maximum and clears `floorDb`: the attacks of hits.
 */
export const onsets = (
  samples: Float32Array,
  opts: { riseDb?: number; floorDb?: number; windowSeconds?: number; lookback?: number; refractory?: number } = {},
): number[] => {
  const w = opts.windowSeconds ?? 0.01;
  const env = peakEnvelope(samples, w);
  const back = Math.round((opts.lookback ?? 0.15) / w);
  const refractory = opts.refractory ?? 0.3;
  const out: number[] = [];
  for (let i = back; i < env.length; i++) {
    const prev = Math.max(...env.slice(i - back, i));
    const level = env[i] ?? -120;
    const t = i * w;
    if (level >= (opts.floorDb ?? -30) && level - prev >= (opts.riseDb ?? 12)) {
      const last = out[out.length - 1];
      if (last === undefined || t - last > refractory) out.push(t);
    }
  }
  return out;
};
