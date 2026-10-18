/** PNG reading, box-filter downscaling and tiling, for contact sheets and pixel comparisons. */
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

export type Image = { width: number; height: number; data: Buffer };

export const readPng = (path: string): Image => {
  const png = PNG.sync.read(readFileSync(path));
  return { width: png.width, height: png.height, data: png.data };
};

export const writePng = (path: string, img: Image): void => {
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy(png.data);
  writeFileSync(path, PNG.sync.write(png));
};

/** Averages each factor x factor block (factor must divide both sides). */
export const downscale = (img: Image, factor: number): Image => {
  const w = Math.floor(img.width / factor);
  const h = Math.floor(img.height / factor);
  const data = Buffer.alloc(w * h * 4);
  const n = factor * factor;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const acc = [0, 0, 0, 0];
      for (let dy = 0; dy < factor; dy++) {
        for (let dx = 0; dx < factor; dx++) {
          const i = ((y * factor + dy) * img.width + (x * factor + dx)) * 4;
          for (let c = 0; c < 4; c++) acc[c] = (acc[c] ?? 0) + (img.data[i + c] ?? 0);
        }
      }
      const o = (y * w + x) * 4;
      for (let c = 0; c < 4; c++) data[o + c] = Math.round((acc[c] ?? 0) / n);
    }
  }
  return { width: w, height: h, data };
};

/** Lays images out in a grid with a gap, on a flat background. */
export const tile = (rows: Image[][], gap: number, background: readonly [number, number, number]): Image => {
  const cellW = Math.max(...rows.flat().map((i) => i.width));
  const cellH = Math.max(...rows.flat().map((i) => i.height));
  const cols = Math.max(...rows.map((r) => r.length));
  const width = cols * cellW + (cols + 1) * gap;
  const height = rows.length * cellH + (rows.length + 1) * gap;
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = background[0];
    data[i * 4 + 1] = background[1];
    data[i * 4 + 2] = background[2];
    data[i * 4 + 3] = 255;
  }
  rows.forEach((row, r) =>
    row.forEach((img, c) => {
      const ox = gap + c * (cellW + gap);
      const oy = gap + r * (cellH + gap);
      for (let y = 0; y < img.height; y++) {
        img.data.copy(data, ((oy + y) * width + ox) * 4, y * img.width * 4, (y + 1) * img.width * 4);
      }
    }),
  );
  return { width, height, data };
};

/** Counts pixels that differ between two same-sized images, skipping a region. */
export const diffOutside = (a: Image, b: Image, skip: { x: number; y: number; w: number; h: number }): number => {
  if (a.width !== b.width || a.height !== b.height) throw new Error("images differ in size");
  let count = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (x >= skip.x && x < skip.x + skip.w && y >= skip.y && y < skip.y + skip.h) continue;
      const i = (y * a.width + x) * 4;
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) count++;
    }
  }
  return count;
};
