/** Small offline DSP kit for synthesising stand-in effects. Mono, 48 kHz. */
import { rng } from "../../src/lib/rng";

export const SR = 48000;
export const samples = (seconds: number): number => Math.round(seconds * SR);

export type Noise = () => number;
export const whiteNoise = (seed: number): Noise => {
  const next = rng(seed);
  return () => next() * 2 - 1;
};

/** RBJ cookbook biquad. */
export class Biquad {
  private b0 = 0;
  private b1 = 0;
  private b2 = 0;
  private a1 = 0;
  private a2 = 0;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(
    private readonly type: "lowpass" | "highpass" | "bandpass",
    freq: number,
    q = Math.SQRT1_2,
  ) {
    this.set(freq, q);
  }

  set(freq: number, q = Math.SQRT1_2): void {
    const w0 = (2 * Math.PI * Math.min(freq, SR * 0.45)) / SR;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    let b0: number;
    let b1: number;
    let b2: number;
    if (this.type === "lowpass") {
      b0 = (1 - cos) / 2;
      b1 = 1 - cos;
      b2 = (1 - cos) / 2;
    } else if (this.type === "highpass") {
      b0 = (1 + cos) / 2;
      b1 = -(1 + cos);
      b2 = (1 + cos) / 2;
    } else {
      b0 = alpha;
      b1 = 0;
      b2 = -alpha;
    }
    const a0 = 1 + alpha;
    this.b0 = b0 / a0;
    this.b1 = b1 / a0;
    this.b2 = b2 / a0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

export const filter = (
  input: Float32Array,
  type: "lowpass" | "highpass" | "bandpass",
  freq: number,
  q?: number,
  passes = 1,
): Float32Array => {
  let buf = input;
  for (let p = 0; p < passes; p++) {
    const bq = new Biquad(type, freq, q);
    const out = new Float32Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = bq.process(buf[i] ?? 0);
    buf = out;
  }
  return buf;
};

export const fill = (n: number, f: (i: number, t: number) => number): Float32Array => {
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = f(i, i / SR);
  return out;
};

export const noiseBuffer = (n: number, seed: number): Float32Array => {
  const w = whiteNoise(seed);
  return fill(n, () => w());
};

/** Pink noise (Paul Kellet's filter). */
export const pinkBuffer = (n: number, seed: number): Float32Array => {
  const w = whiteNoise(seed);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  return fill(n, () => {
    const white = w();
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    const out = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
    b6 = white * 0.115926;
    return out * 0.11;
  });
};

/** Brown noise (leaky integrated white). */
export const brownBuffer = (n: number, seed: number): Float32Array => {
  const w = whiteNoise(seed);
  let last = 0;
  return fill(n, () => {
    last = (last + 0.02 * w()) * 0.998;
    return last * 3.5;
  });
};

export const add = (into: Float32Array, src: Float32Array, at = 0, gain = 1): Float32Array => {
  for (let i = 0; i < src.length && at + i < into.length; i++) {
    if (at + i >= 0) into[at + i] = (into[at + i] ?? 0) + (src[i] ?? 0) * gain;
  }
  return into;
};

export const multiply = (buf: Float32Array, f: (t: number, i: number) => number): Float32Array =>
  buf.map((v, i) => v * f(i / SR, i));

export const softClip = (buf: Float32Array, drive = 1.5): Float32Array =>
  buf.map((v) => Math.tanh(v * drive) / Math.tanh(drive));

export const peak = (buf: Float32Array): number => buf.reduce((m, v) => Math.max(m, Math.abs(v)), 0);

export const normalise = (buf: Float32Array, peakDb: number): Float32Array => {
  const p = peak(buf);
  const target = Math.pow(10, peakDb / 20);
  return p === 0 ? buf : buf.map((v) => (v / p) * target);
};

/** Short linear fades at both ends, so one-shots never click. */
export const edges = (buf: Float32Array, inSeconds = 0.002, outSeconds = 0.01): Float32Array => {
  const a = samples(inSeconds);
  const b = samples(outSeconds);
  return buf.map((v, i) => v * Math.min(1, i / Math.max(1, a), (buf.length - 1 - i) / Math.max(1, b)));
};

/**
 * Makes a seamless loop of `length` samples from a buffer with at least
 * `length + fade` samples, by crossfading the tail into the head.
 */
export const loopable = (buf: Float32Array, length: number, fade: number): Float32Array => {
  const out = buf.slice(0, length);
  for (let i = 0; i < fade; i++) {
    const t = i / fade;
    out[i] = (buf[i] ?? 0) * Math.sqrt(t) + (buf[length + i] ?? 0) * Math.sqrt(1 - t);
  }
  return out;
};

/** A sine whose frequency follows f(t), integrated for a smooth sweep. */
export const sweep = (n: number, freqAt: (t: number) => number, phase0 = 0): Float32Array => {
  let phase = phase0;
  return fill(n, (_, t) => {
    phase += (2 * Math.PI * freqAt(t)) / SR;
    return Math.sin(phase);
  });
};
