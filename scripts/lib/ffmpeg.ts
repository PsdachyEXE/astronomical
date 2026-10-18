/**
 * System ffmpeg, for the radio filter and the loudness pass. Everything that
 * uses it checks `ffmpegAvailable()` first and degrades with a warning, so a
 * machine without ffmpeg still renders (without those two passes).
 */
import { spawnSync } from "node:child_process";

let cached: boolean | null = null;

export const ffmpegAvailable = (disabledByFlag = false): boolean => {
  if (disabledByFlag || process.env.TALLY_NO_FFMPEG === "1") return false;
  if (cached === null) {
    const probe = spawnSync("ffmpeg", ["-hide_banner", "-version"], { encoding: "utf8" });
    cached = probe.status === 0;
  }
  return cached;
};

export const runFfmpeg = (args: readonly string[]): string => {
  const res = spawnSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error(`ffmpeg failed (${res.status}):\nffmpeg ${args.join(" ")}\n${res.stderr.slice(-3000)}`);
  }
  return res.stderr;
};

export const runFfprobe = (args: readonly string[]): string => {
  const res = spawnSync("ffprobe", ["-v", "error", ...args], { encoding: "utf8" });
  if (res.status !== 0) throw new Error(`ffprobe failed: ${res.stderr}`);
  return res.stdout;
};
