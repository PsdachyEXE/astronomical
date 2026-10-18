/**
 * npm run make-sfx [-- --force]
 *
 * Writes a seeded, synthesised stand-in for every effect slot still marked
 * `placeholder` in src/sfx.ts (CC0 libraries were unreachable from the build
 * machine), then writes assets/sfx/index.json (durations measured from the
 * files) and regenerates assets/MANIFEST.md. A slot whose placeholder flag
 * has been cleared is never overwritten: drop the real CC0 file in, update
 * src/sfx.ts, and rerun to refresh the index and manifest.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashSeed, rng } from "../src/lib/rng";
import { SFX, SFX_IDS, type SfxId } from "../src/sfx";
import { flagBool, main, parseArgs } from "./lib/args";
import {
  add,
  Biquad,
  brownBuffer,
  edges,
  fill,
  filter,
  loopable,
  multiply,
  noiseBuffer,
  normalise,
  pinkBuffer,
  samples,
  softClip,
  SR,
  sweep,
} from "./lib/dsp";
import { ASSETS } from "./lib/paths";
import { writeManifest } from "./lib/manifest";
import { buildSfxIndex } from "./lib/sfx-index";
import { writeWav } from "./lib/wav";

const seedFor = (id: SfxId, part = ""): number => hashSeed(`tally-sfx:${id}:${part}`);
const TAU = 2 * Math.PI;

const click = (): Float32Array => {
  const n = samples(0.06);
  const out = new Float32Array(n);
  const burst = multiply(noiseBuffer(samples(0.008), seedFor("click")), (t) => Math.exp(-t / 0.0015));
  add(out, filter(burst, "highpass", 900), 0, 1);
  add(out, filter(burst, "highpass", 1400), samples(0.021), 0.55);
  add(out, multiply(fill(samples(0.03), (_, t) => Math.sin(TAU * 1850 * t)), (t) => Math.exp(-t / 0.005)), 0, 0.35);
  return edges(normalise(out, -3), 0.0005, 0.005);
};

const rumble = (): Float32Array => {
  const len = samples(8);
  const fade = samples(0.6);
  const noise = filter(brownBuffer(len + fade, seedFor("rumble")), "lowpass", 95, Math.SQRT1_2, 2);
  const bed = loopable(noise, len, fade);
  // 38 Hz x 8 s and a 2 s swell are whole cycles, so the tone loops cleanly too.
  const tone = fill(len, (_, t) => 0.35 * Math.sin(TAU * 38 * t) * (0.75 + 0.25 * Math.sin((TAU * t) / 2)));
  return normalise(add(normalise(bed, -1), tone), -3);
};

const glass = (): Float32Array => {
  const n = samples(1.9);
  const out = new Float32Array(n);
  const next = rng(seedFor("glass"));
  const crash = multiply(filter(noiseBuffer(samples(0.35), seedFor("glass", "crash")), "highpass", 2200, 0.9, 2), (t) =>
    Math.exp(-t / 0.045),
  );
  add(out, crash, 0, 0.9);
  for (let i = 0; i < 70; i++) {
    const r = next();
    const onset = 1.2 * r * r;
    const freq = 2600 + next() * 6400;
    const decay = 0.015 + next() * 0.09;
    const amp = (0.12 + next() * 0.4) * (1 - onset / 1.5);
    const ping = fill(samples(decay * 6), (_, t) => Math.sin(TAU * freq * t) * Math.exp(-t / decay));
    add(out, ping, samples(onset), amp);
  }
  for (let i = 0; i < 18; i++) {
    const tick = multiply(filter(noiseBuffer(samples(0.01), seedFor("glass", `tick${i}`)), "highpass", 3000), (t) =>
      Math.exp(-t / 0.002),
    );
    add(out, tick, samples(0.25 + next() * 1.3), 0.25 * next());
  }
  return edges(normalise(out, -2));
};

const boom = (): Float32Array => {
  const n = samples(4.6);
  const out = new Float32Array(n);
  const thump = multiply(filter(brownBuffer(samples(1.2), seedFor("boom", "thump")), "lowpass", 240, 0.8, 2), (t) =>
    Math.min(1, t / 0.004) * Math.exp(-t / 0.22),
  );
  add(out, normalise(thump, 0), 0, 0.9);
  const sub = multiply(
    sweep(samples(3.6), (t) => 28 + 42 * Math.exp(-t / 0.9)),
    (t) => Math.min(1, t / 0.01) * Math.exp(-t / 1.1),
  );
  add(out, sub, 0, 0.95);
  const tail = multiply(filter(brownBuffer(n, seedFor("boom", "tail")), "lowpass", 130, 0.7, 2), (t) =>
    Math.min(1, t / 0.05) * Math.exp(-t / 1.4),
  );
  add(out, normalise(tail, 0), 0, 0.45);
  return edges(normalise(softClip(normalise(out, 0), 1.8), -1), 0.001, 0.2);
};

const ring = (): Float32Array => {
  const n = samples(8);
  return edges(
    normalise(
      fill(n, (_, t) => (Math.sin(TAU * 6200 * t) + 0.6 * Math.sin(TAU * 6206 * t)) * Math.min(1, t / 0.3) * Math.exp(-t / 2.4)),
      -6,
    ),
    0.01,
    0.3,
  );
};

const footstep = (): Float32Array => {
  const n = samples(0.32);
  const out = new Float32Array(n);
  const next = rng(seedFor("footstep"));
  for (let i = 0; i < 46; i++) {
    const heel = i < 26;
    const onset = heel ? next() * 0.045 : 0.07 + next() * 0.06;
    const grain = multiply(noiseBuffer(samples(0.004), seedFor("footstep", `g${i}`)), (t) => Math.exp(-t / 0.0012));
    add(out, grain, samples(onset), (heel ? 0.9 : 0.6) * (0.3 + next() * 0.7));
  }
  const crunch = filter(filter(out, "highpass", 1300, 0.8), "lowpass", 7000);
  const thud = multiply(filter(noiseBuffer(samples(0.12), seedFor("footstep", "thud")), "lowpass", 220, 0.8, 2), (t) =>
    Math.exp(-t / 0.025),
  );
  return edges(normalise(add(normalise(crunch, -2), normalise(thud, -8)), -3));
};

const wind = (): Float32Array => {
  const len = samples(30);
  const fade = samples(1.5);
  const total = len + fade;
  const src = pinkBuffer(total, seedFor("wind"));
  const out = new Float32Array(total);
  const bp = filterVarying(src, (t) => 380 + 220 * Math.sin((TAU * t) / 10) + 90 * Math.sin((TAU * t) / 3.75));
  for (let i = 0; i < total; i++) {
    const t = i / SR;
    // Swell periods divide 30 s, so the loop point is invisible.
    out[i] = (bp[i] ?? 0) * (0.62 + 0.28 * Math.sin((TAU * t) / 7.5) + 0.1 * Math.sin((TAU * t) / 2.5));
  }
  return normalise(loopable(out, len, fade), -6);
};

/** Band-pass whose centre follows f(t), updated every 64 samples. */
const filterVarying = (input: Float32Array, centreAt: (t: number) => number, q = 0.8): Float32Array => {
  const out = new Float32Array(input.length);
  const bq = new Biquad("bandpass", centreAt(0), q);
  for (let i = 0; i < input.length; i++) {
    if (i % 64 === 0) bq.set(centreAt(i / SR), q);
    out[i] = bq.process(input[i] ?? 0);
  }
  return out;
};

const staticSweep = (): Float32Array => {
  const n = samples(0.7);
  const hiss = filterVarying(noiseBuffer(n, seedFor("static-sweep")), (t) => 600 + 2600 * Math.min(1, t / 0.55), 1.6);
  const env = (t: number) => Math.min(1, t / 0.02) * Math.min(1, (0.7 - t) / 0.15);
  const whistle = sweep(n, (t) => 2300 - 1400 * Math.min(1, t / 0.6));
  const out = multiply(add(normalise(hiss, -2), whistle, 0, 0.12), env);
  return edges(normalise(out, -4));
};

const staticBed = (): Float32Array => {
  const len = samples(10);
  const fade = samples(0.5);
  const total = len + fade;
  const next = rng(seedFor("static-bed", "pops"));
  const hiss = filter(filter(noiseBuffer(total, seedFor("static-bed")), "highpass", 300, Math.SQRT1_2, 2), "lowpass", 3400, Math.SQRT1_2, 2);
  const out = multiply(normalise(hiss, -6), (t) => 0.85 + 0.15 * Math.sin(TAU * 5 * t));
  for (let i = 0; i < 300; i++) {
    const pop = multiply(noiseBuffer(samples(0.003), seedFor("static-bed", `p${i}`)), (t) => Math.exp(-t / 0.0008));
    add(out, pop, Math.floor(next() * len), 0.2 + 0.5 * next());
  }
  return normalise(loopable(out, len, fade), -6);
};

const bang = (): Float32Array => {
  const n = samples(1.5);
  const out = new Float32Array(n);
  const hit = multiply(filter(noiseBuffer(samples(0.05), seedFor("bang", "hit")), "lowpass", 3200), (t) => Math.exp(-t / 0.006));
  add(out, hit, 0, 0.8);
  const partials: readonly [number, number, number][] = [
    [92, 1, 0.5],
    [147, 0.8, 0.42],
    [233, 0.6, 0.35],
    [318, 0.5, 0.3],
    [461, 0.35, 0.22],
    [587, 0.25, 0.18],
    [803, 0.15, 0.12],
  ];
  for (const [f, a, d] of partials) {
    add(out, fill(n, (_, t) => Math.sin(TAU * f * (1 - 0.01 * Math.min(1, t / 0.4)) * t) * Math.exp(-t / d)), 0, a * 0.4);
  }
  add(out, fill(samples(0.4), (_, t) => Math.sin(TAU * 58 * t) * Math.exp(-t / 0.07)), 0, 0.9);
  return edges(normalise(softClip(normalise(out, 0), 1.6), -1), 0.0005, 0.05);
};

const drone = (): Float32Array => {
  const n = samples(20);
  // 50 Hz x 20 s and a 5 s swell are whole cycles: a seamless loop.
  return normalise(
    fill(n, (_, t) => (Math.sin(TAU * 50 * t) + 0.15 * Math.sin(TAU * 100 * t) + 0.05 * Math.sin(TAU * 150 * t)) *
      (0.85 + 0.15 * Math.sin((TAU * t) / 5))),
    -6,
  );
};

const MAKERS: Record<SfxId, () => Float32Array> = {
  click,
  rumble,
  glass,
  boom,
  ring,
  footstep,
  wind,
  "static-sweep": staticSweep,
  "static-bed": staticBed,
  bang,
  drone,
};

main(() => {
  const args = parseArgs(process.argv.slice(2));
  const force = flagBool(args, "force");
  mkdirSync(join(ASSETS, "sfx"), { recursive: true });
  for (const id of SFX_IDS) {
    const slot = SFX[id];
    const path = join(ASSETS, slot.file);
    if (!slot.placeholder) {
      console.log(`  keep   ${slot.file} (real file)`);
      continue;
    }
    if (existsSync(path) && !force) {
      console.log(`  keep   ${slot.file} (placeholder exists; --force to rebuild)`);
      continue;
    }
    writeWav(path, SR, [MAKERS[id]()]);
    console.log(`  made   ${slot.file} (PLACEHOLDER)`);
  }
  const index = buildSfxIndex();
  writeFileSync(join(ASSETS, "sfx", "index.json"), JSON.stringify(index, null, 2) + "\n");
  writeManifest(index);
  console.log("✓ assets/sfx/index.json and assets/MANIFEST.md written");
});
