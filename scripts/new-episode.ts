/**
 * npm run new-episode -- docs/epNN.md [--force] [--no-tts]
 *
 * Scaffolds episodes/epNN.json from the markdown cue table, so a new episode
 * is a writing task, not a build. Checks the result by building its timeline
 * with estimated clip lengths before writing, prints what it guessed and what
 * it could not place, then runs the TTS step (placeholder or whichever
 * provider is configured) so `npm run timeline -- epNN` works straight away.
 * An existing episode file is never overwritten without --force: once
 * scaffolded, the JSON is the source of truth and may hold hand edits.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEpisode } from "../src/lib/episode";
import { buildTimeline } from "../src/lib/timeline";
import { clipHash, clipKey, evenWords, type Timing } from "../src/lib/timing";
import { estimateSeconds, isVoiceId, wordsOf } from "../src/voices";
import { flagBool, main, parseArgs } from "./lib/args";
import { convertMarkdown } from "./lib/convert";
import { episodeFile, ROOT, slugOf } from "./lib/paths";
import { buildSfxIndex } from "./lib/sfx-index";

main(() => {
  const args = parseArgs(process.argv.slice(2));
  const input = args.positional[0];
  if (input === undefined) throw new Error("Usage: npm run new-episode -- docs/epNN.md [--force] [--no-tts]");
  const path = resolve(ROOT, input);
  if (!existsSync(path)) throw new Error(`No such file: ${input}`);
  const slug = slugOf(input);
  const target = episodeFile(slug);
  if (existsSync(target) && !flagBool(args, "force")) {
    throw new Error(`episodes/${slug}.json already exists and may hold hand edits; pass --force to replace it`);
  }

  const { episode: draft, report } = convertMarkdown(readFileSync(path, "utf8"), slug);
  const episode = parseEpisode(draft, `episodes/${slug}.json (scaffold)`);

  // Dry run with clip lengths estimated from each voice's pace, as placeholder mode would make them.
  const clips: Timing["clips"] = {};
  for (const cue of episode.cues) {
    cue.narration.forEach((line, i) => {
      if (!isVoiceId(line.voice)) throw new Error(`${cue.id}: unknown voice ${line.voice}`);
      const d = estimateSeconds(line.text, line.voice, line.pace ?? 1);
      clips[clipKey(cue.id, i)] = {
        file: `voice/${slug}/${cue.id}-${i}.wav`,
        voice: line.voice,
        text: line.text,
        pace: line.pace ?? 1,
        duration: d,
        words: evenWords(wordsOf(line.text), d),
        wordTiming: "estimated",
        hash: clipHash(line.voice, line.text, line.pace ?? 1),
      };
    });
  }
  const { timeline, problems } = buildTimeline({ slug, episode, timing: { episode: slug, provider: "estimate", clips }, sfx: buildSfxIndex() });

  writeFileSync(target, JSON.stringify(draft, null, 2) + "\n");
  console.log(`✓ episodes/${slug}.json: DAY ${episode.day}, ${episode.cues.length} cues, about ${timeline.duration.toFixed(1)} s at the voices' natural pace`);
  if (report.guesses.length > 0) console.log(`\nGuessed (check these):\n  ${report.guesses.join("\n  ")}`);
  if (report.unparsed.length > 0) console.log(`\nNot placed (add by hand):\n  ${report.unparsed.join("\n  ")}`);
  for (const p of problems) console.log(`${p.level === "error" ? "✗" : "!"} [${p.code}] ${p.message}`);

  if (!flagBool(args, "no-tts")) {
    const tts = spawnSync("npm", ["run", "--silent", "tts", "--", slug], { cwd: ROOT, stdio: "inherit" });
    if (tts.status !== 0) throw new Error("the TTS step failed");
  }
  console.log(`\nNext: npm run timeline -- ${slug}, then npm run render -- ${slug} --platform all`);
});
