/** Minimal PCM WAV reading and writing; enough for clips, effects and checks. */
import { readFileSync, writeFileSync } from "node:fs";

export type WavInfo = { sampleRate: number; channels: number; bitsPerSample: number; frames: number; duration: number };

const findChunk = (buf: Buffer, id: string): { offset: number; size: number } | null => {
  let pos = 12;
  while (pos + 8 <= buf.length) {
    const chunkId = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (chunkId === id) return { offset: pos + 8, size };
    pos += 8 + size + (size % 2);
  }
  return null;
};

export const readWavInfo = (path: string): WavInfo => {
  const buf = readFileSync(path);
  if (buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error(`${path} is not a WAV file`);
  }
  const fmt = findChunk(buf, "fmt ");
  const data = findChunk(buf, "data");
  if (fmt === null || data === null) throw new Error(`${path} has no fmt or data chunk`);
  const channels = buf.readUInt16LE(fmt.offset + 2);
  const sampleRate = buf.readUInt32LE(fmt.offset + 4);
  const bitsPerSample = buf.readUInt16LE(fmt.offset + 14);
  const blockAlign = buf.readUInt16LE(fmt.offset + 12);
  const size = Math.min(data.size, buf.length - data.offset);
  const frames = Math.floor(size / blockAlign);
  return { sampleRate, channels, bitsPerSample, frames, duration: frames / sampleRate };
};

/** Reads a 16-bit PCM WAV into one Float32Array per channel. */
export const readWav = (path: string): { sampleRate: number; channels: Float32Array[] } => {
  const buf = readFileSync(path);
  const info = readWavInfo(path);
  if (info.bitsPerSample !== 16) throw new Error(`${path}: only 16-bit PCM is supported`);
  const data = findChunk(buf, "data");
  if (data === null) throw new Error(`${path} has no data chunk`);
  const channels = Array.from({ length: info.channels }, () => new Float32Array(info.frames));
  for (let i = 0; i < info.frames; i++) {
    for (let c = 0; c < info.channels; c++) {
      const sample = buf.readInt16LE(data.offset + (i * info.channels + c) * 2);
      const channel = channels[c];
      if (channel !== undefined) channel[i] = sample / 32768;
    }
  }
  return { sampleRate: info.sampleRate, channels };
};

/** Writes mono or multichannel float samples (-1 to 1) as 16-bit PCM. */
export const writeWav = (path: string, sampleRate: number, channels: readonly Float32Array[]): void => {
  const frames = channels[0]?.length ?? 0;
  const n = channels.length;
  const dataSize = frames * n * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(n, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * n * 2, 28);
  buf.writeUInt16LE(n * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  let pos = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < n; c++) {
      const v = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      buf.writeInt16LE(Math.round(v < 0 ? v * 32768 : v * 32767), pos);
      pos += 2;
    }
  }
  writeFileSync(path, buf);
};
