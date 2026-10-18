/**
 * npm run render -- <episode> --platform <master|youtube|instagram|snapchat|tiktok|facebook|all> [--no-ffmpeg]
 *
 * Renders out/<episode>.<target>.mp4: 1080 x 1920, 30 fps, H.264 high
 * profile, AAC 192 kbps. With system ffmpeg, Remotion encodes the picture
 * with the target's preset and writes the mix to a separate WAV, then the
 * loudness pass brings it to -16 LUFS / -1.5 dBTP and muxes it in. Without
 * ffmpeg (or with --no-ffmpeg) Remotion writes the finished file directly and
 * the loudness pass is skipped, with a warning. Also writes the thumbnail
 * out/<episode>.png from the master's DAY card.
 */
import { copyFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { renderMedia, type FfmpegOverrideFn } from "@remotion/renderer";
import type { EpisodeProps } from "../src/lib/props";
import type { Timeline } from "../src/lib/timeline";
import { isTargetId, PLATFORM_IDS, platformConfig, type TargetId } from "../src/platforms";
import { flagBool, flagString, main, parseArgs } from "./lib/args";
import { ffmpegAvailable, runFfmpeg } from "./lib/ffmpeg";
import { loadTimeline } from "./lib/inputs";
import { loudnessPass } from "./lib/loudness";
import { outFile, slugOf, tmpDir } from "./lib/paths";
import { browserExecutable, closeBrowser, episodeComposition, episodeProps, renderEpisodeStill, serveUrl } from "./lib/remotion";

const ALL: readonly TargetId[] = ["master", ...PLATFORM_IDS];

/** Adds the H.264 profile and level Remotion has no option for. */
const profileOverride =
  (level: string): FfmpegOverrideFn =>
  ({ args }) => {
    if (!args.includes("libx264")) return args;
    const out = [...args];
    const last = out.pop();
    return last === undefined ? args : [...out, "-profile:v", "high", "-level:v", level, last];
  };

const renderTarget = async (slug: string, target: TargetId, useFfmpeg: boolean, concurrency: number): Promise<void> => {
  const cfg = platformConfig(target);
  const enc = cfg.encode;
  const props: EpisodeProps = episodeProps(slug, target);
  const composition = await episodeComposition(props);
  const final = outFile(`${slug}.${target}.mp4`);
  const work = tmpDir("render", `${slug}.${target}`);
  const video = useFfmpeg ? join(work, "video.mp4") : final;
  const mix = join(work, "mix.wav");
  let shown = -1;
  const started = Date.now();
  await renderMedia({
    serveUrl: await serveUrl(),
    composition,
    inputProps: props,
    codec: "h264",
    outputLocation: video,
    crf: enc.crf,
    x264Preset: enc.x264Preset,
    pixelFormat: "yuv420p",
    encodingMaxRate: enc.maxrateKbps === null ? null : `${enc.maxrateKbps}k`,
    encodingBufferSize: enc.maxrateKbps === null ? null : `${enc.maxrateKbps * 2}k`,
    // With a separate mix the codec follows the .wav extension (PCM); otherwise AAC.
    audioCodec: useFfmpeg ? "pcm-16" : "aac",
    audioBitrate: useFfmpeg ? null : `${enc.audioKbps}k`,
    sampleRate: enc.audioSampleRate,
    separateAudioTo: useFfmpeg ? mix : null,
    enforceAudioTrack: true,
    ffmpegOverride: profileOverride(enc.level),
    concurrency,
    imageFormat: "png",
    overwrite: true,
    browserExecutable: browserExecutable(),
    logLevel: "error",
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 10) * 10;
      if (pct !== shown) {
        shown = pct;
        process.stdout.write(`${pct}% `);
      }
    },
  });
  process.stdout.write(`(${((Date.now() - started) / 1000).toFixed(0)} s)\n`);

  if (useFfmpeg) {
    const aac = join(work, "mix.m4a");
    const loud = loudnessPass(mix, aac, work, enc.audioKbps);
    runFfmpeg(["-y", "-i", video, "-i", aac, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "copy", "-movflags", "+faststart", "-shortest", final]);
    console.log(`  ✓ ${slug}.${target}.mp4  ${loud.integrated.toFixed(1)} LUFS, true peak ${loud.truePeak.toFixed(1)} dBTP (gain ${loud.gain >= 0 ? "+" : ""}${loud.gain.toFixed(1)} dB)`);
  } else {
    console.log(`  ✓ ${slug}.${target}.mp4  (no loudness pass: system ffmpeg unavailable)`);
  }
};

/** The thumbnail: the master's DAY card, fully drawn, with no caption over it. */
const renderThumbnail = async (slug: string, timeline: Timeline): Promise<void> => {
  const card = timeline.cues.find((c) => c.state.kind === "day-card") ?? timeline.cues[0];
  if (card === undefined) return;
  let frame = card.endFrame - 1;
  for (let f = card.endFrame - 1; f >= card.startFrame; f--) {
    const t = f / timeline.fps;
    if (!timeline.captions.some((p) => t >= p.start && t < p.end)) {
      frame = f;
      break;
    }
  }
  const tmp = join(tmpDir("render"), `${slug}.thumb.png`);
  await renderEpisodeStill(episodeProps(slug, "master"), frame, tmp);
  copyFileSync(tmp, outFile(`${slug}.png`));
  console.log(`  ✓ ${slug}.png (frame ${frame})`);
};

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "");
  const which = flagString(args, "platform") ?? "master";
  if (slug === "") throw new Error("Usage: npm run render -- <episode> --platform <target|all> [--no-ffmpeg]");
  if (which !== "all" && !isTargetId(which)) throw new Error(`Unknown platform "${which}". Use master, ${PLATFORM_IDS.join(", ")} or all.`);
  const targets: readonly TargetId[] = which === "all" ? ALL : [which as TargetId];
  const useFfmpeg = ffmpegAvailable(flagBool(args, "no-ffmpeg"));
  if (!useFfmpeg) console.warn("! System ffmpeg not found or disabled: rendering without the loudness pass.");
  const concurrency = Number(flagString(args, "concurrency") ?? 4);

  const { timeline, problems } = loadTimeline(slug);
  const errors = problems.filter((p) => p.level === "error");
  if (errors.length > 0) throw new Error(`timeline has ${errors.length} error(s); run npm run timeline -- ${slug}`);
  console.log(`${slug}: ${timeline.duration.toFixed(2)} s, ${timeline.frames} frames → ${targets.join(", ")}`);

  for (const target of targets) {
    process.stdout.write(`  ${platformConfig(target).label}: `);
    await renderTarget(slug, target, useFfmpeg, concurrency);
  }
  if (targets.includes("master")) await renderThumbnail(slug, timeline);
  await closeBrowser();
  rmSync(join(tmpDir("render")), { recursive: true, force: true });
});
