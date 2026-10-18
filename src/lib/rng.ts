/**
 * Seeded randomness. Renders are deterministic: anything that looks random
 * (glass, rain, dust, shakes, pitch variance) draws from here with a seed
 * derived from the episode and cue, never from Math.random.
 */

/** FNV-1a 32-bit hash of a string, for turning names into seeds. */
export const hashSeed = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

/** Mulberry32: small, fast, good enough for visuals and audio jitter. */
export const rng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/** A uniform value in [min, max) from a seeded generator. */
export const between = (next: () => number, min: number, max: number): number =>
  min + (max - min) * next();
