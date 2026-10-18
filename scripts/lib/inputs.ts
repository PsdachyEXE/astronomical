/** Loads everything the timeline needs for one episode, from disk. */
import { existsSync } from "node:fs";
import { parseEpisode, type Episode } from "../../src/lib/episode";
import { buildTimeline, type Problem, type Timeline } from "../../src/lib/timeline";
import { TimingSchema, type Timing } from "../../src/lib/timing";
import type { SfxIndex } from "../../src/sfx";
import { episodeFile, readJson, timingFile } from "./paths";
import { buildSfxIndex } from "./sfx-index";

export type EpisodeInputs = { slug: string; episode: Episode; timing: Timing; sfx: SfxIndex };

export const loadInputs = (slug: string): EpisodeInputs => {
  const episode = parseEpisode(readJson(episodeFile(slug)), `episodes/${slug}.json`);
  if (!existsSync(timingFile(slug))) {
    throw new Error(`No timing for ${slug}. Run: npm run tts -- ${slug}`);
  }
  const timing = TimingSchema.parse(readJson(timingFile(slug)));
  return { slug, episode, timing, sfx: buildSfxIndex() };
};

export const loadTimeline = (slug: string): EpisodeInputs & { timeline: Timeline; problems: Problem[] } => {
  const inputs = loadInputs(slug);
  return { ...inputs, ...buildTimeline(inputs) };
};
