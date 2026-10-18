/** Where everything lives, from the repository root. */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const ASSETS = join(ROOT, "assets");
export const OUT = join(ROOT, "out");

/** "ep01", "episodes/ep01.json" and "ep01.json" all name the episode "ep01". */
export const slugOf = (arg: string): string =>
  arg.replace(/^.*[\\/]/, "").replace(/\.(json|md)$/, "");

export const episodeFile = (slug: string): string => join(ROOT, "episodes", `${slug}.json`);
export const voiceDir = (slug: string): string => join(ASSETS, "voice", slug);
export const timingFile = (slug: string): string => join(voiceDir(slug), "timing.json");
export const outFile = (name: string): string => join(OUT, name);
export const tmpDir = (...parts: string[]): string => {
  const dir = join(OUT, "tmp", ...parts);
  mkdirSync(dir, { recursive: true });
  return dir;
};
export const docFile = (slug: string): string => join(ROOT, "docs", `${slug}.md`);

export const readJson = (path: string): unknown => {
  if (!existsSync(path)) throw new Error(`Missing file: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
};

/** Path relative to assets/, as Remotion's staticFile wants it. */
export const assetRelative = (absolute: string): string =>
  absolute.startsWith(ASSETS + "/") ? absolute.slice(ASSETS.length + 1) : absolute;
