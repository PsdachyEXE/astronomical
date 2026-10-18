/**
 * npm run stills -- <episode> --at 12.4,30,58.2 [--platform master] [--debug]
 *
 * Dev aid: renders single frames to out/tmp/stills/ for a quick look.
 */
import { join } from "node:path";
import { isTargetId } from "../src/platforms";
import { flagBool, flagString, main, parseArgs } from "./lib/args";
import { slugOf, tmpDir } from "./lib/paths";
import { episodeProps, renderEpisodeStill } from "./lib/remotion";

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "");
  const at = (flagString(args, "at") ?? "1").split(",").map(Number);
  const platform = flagString(args, "platform") ?? "master";
  if (!isTargetId(platform)) throw new Error(`Unknown platform ${platform}`);
  const props = episodeProps(slug, platform, flagBool(args, "debug"));
  const dir = tmpDir("stills");
  for (const seconds of at) {
    const frame = Math.round(seconds * 30);
    const file = join(dir, `${slug}.${platform}.${String(frame).padStart(4, "0")}.png`);
    await renderEpisodeStill(props, frame, file);
    console.log(`  ${seconds.toFixed(2)} s → ${file}`);
  }
});
