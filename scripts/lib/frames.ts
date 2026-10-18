/** Pulls single frames out of a rendered MP4 as RGB, for checks on the finished file. */
import { spawnSync } from "node:child_process";
import type { Box } from "../../src/layout";

export type Rgb = { width: number; height: number; data: Buffer };

/** Frame n (0-based) of a video, full size, as packed RGB. */
export const frameRgb = (video: string, n: number, width = 1080, height = 1920): Rgb => {
  const res = spawnSync(
    "ffmpeg",
    ["-hide_banner", "-nostdin", "-v", "error", "-i", video, "-vf", `select=eq(n\\,${n})`, "-vsync", "0", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 64 * 1024 * 1024 },
  );
  if (res.status !== 0 || res.stdout.length !== width * height * 3) {
    throw new Error(`could not read frame ${n} of ${video}: ${res.stderr.toString().slice(-500)}`);
  }
  return { width, height, data: res.stdout };
};

/** Mean luma (0 to 255) over a box of an RGB frame. */
export const meanLuma = (img: Rgb, box?: Box): number => {
  const x0 = Math.max(0, Math.floor(box?.x ?? 0));
  const y0 = Math.max(0, Math.floor(box?.y ?? 0));
  const x1 = Math.min(img.width, Math.ceil(box === undefined ? img.width : box.x + box.w));
  const y1 = Math.min(img.height, Math.ceil(box === undefined ? img.height : box.y + box.h));
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * img.width + x) * 3;
      sum += 0.299 * (img.data[i] ?? 0) + 0.587 * (img.data[i + 1] ?? 0) + 0.114 * (img.data[i + 2] ?? 0);
      n++;
    }
  }
  return n === 0 ? 0 : sum / n;
};

/** Fraction of pixels in a box brighter than a luma threshold. */
export const brightFraction = (img: Rgb, box: Box, threshold = 128): number => {
  let bright = 0;
  let n = 0;
  for (let y = Math.floor(box.y); y < Math.ceil(box.y + box.h); y++) {
    for (let x = Math.floor(box.x); x < Math.ceil(box.x + box.w); x++) {
      const i = (y * img.width + x) * 3;
      const l = 0.299 * (img.data[i] ?? 0) + 0.587 * (img.data[i + 1] ?? 0) + 0.114 * (img.data[i + 2] ?? 0);
      if (l > threshold) bright++;
      n++;
    }
  }
  return n === 0 ? 0 : bright / n;
};
