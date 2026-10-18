/**
 * npm run tts -- <episode> [--provider placeholder] [--force] [--no-ffmpeg]
 *
 * One clip per narration line, then timing.json with each clip's measured
 * length and word timestamps. Radio voices are band-passed (300 to 3400 Hz)
 * with a static bed at -24 dB by system ffmpeg; without ffmpeg the raw clip
 * is used and a warning printed. Unchanged lines are reused, not regenerated.
 */
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { parseEpisode } from "../src/lib/episode";
import { clipHash, clipKey, evenWords, TimingSchema, type ClipTiming, type Timing } from "../src/lib/timing";
import { SFX } from "../src/sfx";
import { isVoiceId, VOICES, wordsOf } from "../src/voices";
import { flagBool, flagString, main, parseArgs } from "./lib/args";
import { ffmpegAvailable, runFfmpeg } from "./lib/ffmpeg";
import { assetRelative, ASSETS, episodeFile, readJson, slugOf, timingFile, voiceDir } from "./lib/paths";
import { providerFor } from "./lib/tts-providers";
import { readWavInfo, writeWav } from "./lib/wav";

const radioFilter = (input: string, output: string): void => {
  const staticBed = join(ASSETS, SFX["static-bed"].file);
  const band = "highpass=f=300:poles=2,highpass=f=300:poles=2,lowpass=f=3400:poles=2,lowpass=f=3400:poles=2";
  if (existsSync(staticBed)) {
    runFfmpeg([
      "-y", "-i", input, "-stream_loop", "-1", "-i", staticBed,
      "-filter_complex", `[0:a]${band}[v];[1:a]volume=-24dB[s];[v][s]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[out]`,
      "-map", "[out]", "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output,
    ]);
  } else {
    console.warn(`  ! static bed missing (${staticBed}); radio filtered without it. Run npm run make-sfx.`);
    runFfmpeg(["-y", "-i", input, "-af", band, "-ar", "48000", "-ac", "1", "-c:a", "pcm_s16le", output]);
  }
};

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "");
  if (slug === "") throw new Error("Usage: npm run tts -- <episode> [--provider name] [--force] [--no-ffmpeg]");
  const providerName = flagString(args, "provider") ?? process.env.TALLY_TTS_PROVIDER ?? "placeholder";
  const provider = providerFor(providerName);
  const force = flagBool(args, "force");
  const useFfmpeg = ffmpegAvailable(flagBool(args, "no-ffmpeg"));
  const episode = parseEpisode(readJson(episodeFile(slug)), `episodes/${slug}.json`);

  const dir = voiceDir(slug);
  mkdirSync(dir, { recursive: true });
  const previous: Timing | null = existsSync(timingFile(slug))
    ? TimingSchema.parse(readJson(timingFile(slug)))
    : null;

  const clips: Record<string, ClipTiming> = {};
  let made = 0;
  let reused = 0;
  let radioUnfiltered = 0;
  for (const cue of episode.cues) {
    for (const [i, line] of cue.narration.entries()) {
      if (!isVoiceId(line.voice)) throw new Error(`${cue.id} line ${i}: unknown voice "${line.voice}"`);
      const voice = VOICES[line.voice];
      const pace = line.pace ?? 1;
      const key = clipKey(cue.id, i);
      const hash = clipHash(line.voice, line.text, pace);
      const base = `${cue.id}-${i}`;
      const finalName = voice.radio && useFfmpeg ? `${base}.radio.wav` : `${base}.wav`;
      const finalPath = join(dir, finalName);
      const old = previous?.clips[key];
      if (!force && old !== undefined && old.hash === hash && old.file === assetRelative(finalPath) && existsSync(finalPath)) {
        clips[key] = old;
        reused++;
        continue;
      }
      const result = await provider.synthesize({ voice: line.voice, text: line.text, pace });
      const rawPath = join(dir, `${base}.wav`);
      writeWav(rawPath, result.sampleRate, [result.samples]);
      if (voice.radio) {
        if (useFfmpeg) radioFilter(rawPath, finalPath);
        else radioUnfiltered++;
      }
      const duration = readWavInfo(finalPath).duration;
      const words = result.words ?? evenWords(wordsOf(line.text), duration);
      clips[key] = {
        file: assetRelative(finalPath),
        voice: line.voice,
        text: line.text,
        pace,
        duration,
        words,
        wordTiming: result.words === null ? "estimated" : "measured",
        hash,
      };
      made++;
    }
  }

  // Remove clips no line uses any more.
  const keep = new Set(Object.values(clips).flatMap((c) => [basename(c.file), basename(c.file).replace(".radio", "")]));
  for (const f of readdirSync(dir)) {
    if (f.endsWith(".wav") && !keep.has(f)) unlinkSync(join(dir, f));
  }

  const timing: Timing = { episode: slug, provider: provider.name, clips };
  writeFileSync(timingFile(slug), JSON.stringify(timing, null, 2) + "\n");
  if (radioUnfiltered > 0) {
    console.warn(`  ! ${radioUnfiltered} radio clip(s) left unfiltered: system ffmpeg not found or --no-ffmpeg given.`);
  }
  console.log(
    `✓ ${slug}: ${made} clip(s) generated, ${reused} reused, provider "${provider.name}" → ${assetRelative(timingFile(slug))}`,
  );
});
