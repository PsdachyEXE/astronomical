/**
 * npm run post-meta -- <episode>
 *
 * Writes out/<episode>.post.json: per platform, a title, a description, a
 * few hashtags and a ready-to-paste caption, built from the day and tally.
 */
import { writeFileSync } from "node:fs";
import { parseEpisode } from "../src/lib/episode";
import { buildPostMeta, checkPostMeta } from "../src/post";
import { main, parseArgs } from "./lib/args";
import { episodeFile, outFile, readJson, slugOf } from "./lib/paths";

main(() => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "");
  if (slug === "") throw new Error("Usage: npm run post-meta -- <episode>");
  const episode = parseEpisode(readJson(episodeFile(slug)), `episodes/${slug}.json`);
  const metas = buildPostMeta(episode, slug);
  const problems = checkPostMeta(metas, episode.hidden?.words ?? []);
  if (problems.length > 0) throw new Error(`post metadata problems:\n  ${problems.join("\n  ")}`);
  const out = {
    episode: episode.episode,
    day: episode.day,
    tally: { open: episode.tally.open, close: episode.tally.close },
    thumbnail: `out/${slug}.png`,
    platforms: Object.fromEntries(metas.map((m) => [m.platform, m])),
  };
  writeFileSync(outFile(`${slug}.post.json`), JSON.stringify(out, null, 2) + "\n");
  for (const m of metas) console.log(`  ${m.label.padEnd(20)} ${m.title}  ${m.hashtags.join(" ")}`);
  console.log(`✓ out/${slug}.post.json`);
});
