/** One bundle per process, the browser to use, and the episode props, for every script that renders. */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition, type BrowserLog } from "@remotion/renderer";
import type { EpisodeProps } from "../../src/lib/props";
import type { TargetId } from "../../src/platforms";
import { episodeFile, readJson, ROOT, ASSETS, timingFile } from "./paths";
import { buildSfxIndex } from "./sfx-index";

/**
 * REMOTION_BROWSER_EXECUTABLE wins; then Playwright's headless shell if one is
 * installed (PLAYWRIGHT_BROWSERS_PATH); otherwise null, and Remotion downloads
 * its own Chrome Headless Shell on first use.
 */
export const browserExecutable = (): string | null => {
  const explicit = process.env.REMOTION_BROWSER_EXECUTABLE;
  if (explicit !== undefined && explicit !== "") return explicit;
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (pw !== undefined && existsSync(pw)) {
    const dir = readdirSync(pw)
      .filter((d) => d.startsWith("chromium_headless_shell-"))
      .sort()
      .pop();
    if (dir !== undefined) {
      const bin = join(pw, dir, "chrome-linux", "headless_shell");
      if (existsSync(bin)) return bin;
    }
  }
  return null;
};

let served: Promise<string> | null = null;

export const serveUrl = (): Promise<string> => {
  if (served === null) {
    served = bundle({ entryPoint: join(ROOT, "src", "index.ts"), publicDir: ASSETS });
  }
  return served;
};

export const episodeProps = (slug: string, platform: TargetId, debug = false): EpisodeProps => ({
  episode: readJson(episodeFile(slug)),
  timing: readJson(timingFile(slug)),
  sfx: buildSfxIndex(),
  slug,
  platform,
  debug,
});

export const episodeComposition = async (props: EpisodeProps) =>
  selectComposition({
    serveUrl: await serveUrl(),
    id: "Episode",
    inputProps: props,
    browserExecutable: browserExecutable(),
    logLevel: "error",
  });

/** Renders one PNG frame of an episode. Returns the browser's console lines. */
export const renderEpisodeStill = async (
  props: EpisodeProps,
  frame: number,
  output: string,
): Promise<string[]> => {
  const composition = await episodeComposition(props);
  const logs: string[] = [];
  await renderStill({
    serveUrl: await serveUrl(),
    composition,
    inputProps: props,
    frame,
    output,
    imageFormat: "png",
    overwrite: true,
    browserExecutable: browserExecutable(),
    logLevel: "error",
    onBrowserLog: (log: BrowserLog) => {
      logs.push(log.text);
    },
  });
  return logs;
};
