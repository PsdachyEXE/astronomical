/**
 * npm run verify -- <episode>
 *
 * Runs Milestone 1's acceptance tests against the real outputs: the rendered
 * files, their decoded audio and pixels, the timeline, the safe-zone report
 * and the fixture episode. Run after `npm run render -- <episode> --platform
 * all` and `npm run safecheck -- <episode>`. Writes out/verify/<episode>.json
 * and exits non-zero if any test fails.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cardLayout, contains, FRAME } from "../src/layout";
import type { Timeline } from "../src/lib/timeline";
import { HIDDEN_FIGURE } from "../src/layout";
import { PLATFORM_IDS, stageFor, type TargetId } from "../src/platforms";
import { readablesAt } from "../src/readables";
import { READABLE } from "../src/scenes/common";
import { decodeMono, onsets } from "./lib/audio-analysis";
import { main, parseArgs } from "./lib/args";
import { CUE_TABLE_HEADER, cueTable, parseCueTable } from "./lib/cue-table";
import { ffmpegAvailable, runFfprobe } from "./lib/ffmpeg";
import { brightFraction, frameRgb, meanLuma } from "./lib/frames";
import { loadTimeline } from "./lib/inputs";
import { measureLoudness } from "./lib/loudness";
import { docFile, outFile, ROOT, slugOf } from "./lib/paths";
import { diffOutside, readPng, tile, writePng } from "./lib/png";
import { closeBrowser, episodeProps, renderEpisodeStill } from "./lib/remotion";

type Result = { id: number; name: string; pass: boolean; details: string[] };
const TARGETS: readonly TargetId[] = ["master", ...PLATFORM_IDS];
const verifyDir = (...p: string[]) => {
  const d = join(ROOT, "out", "verify", ...p);
  mkdirSync(d, { recursive: true });
  return d;
};
const s2 = (x: number) => x.toFixed(2);

class Fail extends Error {}
const expect = (ok: boolean, message: string): void => {
  if (!ok) throw new Fail(message);
};

const npm = (...args: string[]): string => {
  const res = spawnSync("npm", ["run", "--silent", ...args], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (res.status !== 0) throw new Fail(`npm run ${args.join(" ")} failed:\n${(res.stdout + res.stderr).slice(-1500)}`);
  return res.stdout;
};

type Probe = { streams: { codec_type: string; codec_name: string; profile?: string; width?: number; height?: number; r_frame_rate?: string; sample_rate?: string }[]; format: { duration: string } };
const probe = (file: string): Probe => JSON.parse(runFfprobe(["-show_streams", "-show_format", "-of", "json", file])) as Probe;

// 1 -------------------------------------------------------------------------
const checkMaster = (slug: string): string[] => {
  const details: string[] = [];
  for (const target of TARGETS) {
    const file = outFile(`${slug}.${target}.mp4`);
    expect(existsSync(file), `${slug}.${target}.mp4 is missing; run npm run render -- ${slug} --platform all`);
    const p = probe(file);
    const v = p.streams.find((s) => s.codec_type === "video");
    const a = p.streams.find((s) => s.codec_type === "audio");
    const duration = Number(p.format.duration);
    expect(v?.codec_name === "h264" && v.profile === "High", `${target}: video is ${v?.codec_name} ${v?.profile}, not H.264 High`);
    expect(v?.width === FRAME.width && v.height === FRAME.height, `${target}: ${v?.width} x ${v?.height}`);
    expect(v?.r_frame_rate === "30/1", `${target}: frame rate ${v?.r_frame_rate}`);
    expect(a?.codec_name === "aac" && a.sample_rate === "48000", `${target}: audio ${a?.codec_name} ${a?.sample_rate}`);
    expect(duration >= 72 && duration <= 75, `${target}: ${s2(duration)} s, outside 72 to 75 s`);
    let loud = "loudness not measured (no system ffmpeg)";
    if (ffmpegAvailable()) {
      const l = measureLoudness(file);
      expect(Math.abs(l.integrated + 16) <= 1, `${target}: ${l.integrated.toFixed(1)} LUFS, outside -16 ±1`);
      expect(l.truePeak <= -1.5, `${target}: true peak ${l.truePeak.toFixed(1)} dBTP, above -1.5`);
      loud = `${l.integrated.toFixed(1)} LUFS, true peak ${l.truePeak.toFixed(1)} dBTP`;
    }
    details.push(`${target}: 1080 x 1920, 30 fps, H.264 High, AAC 48 kHz, ${s2(duration)} s, ${loud}`);
  }
  return details;
};

// 2 -------------------------------------------------------------------------
const checkCueStarts = (slug: string, tl: Timeline): string[] => {
  const doc = parseCueTable(readFileSync(docFile(slug), "utf8"));
  const written = JSON.parse(readFileSync(outFile(`${slug}.timeline.json`), "utf8")) as Timeline;
  const out: string[] = [];
  let worst = 0;
  for (const row of doc) {
    const cue = written.cues.find((c) => c.id === row.cue);
    expect(cue !== undefined, `${row.cue} is in the doc but not in out/${slug}.timeline.json`);
    const d = (cue?.start ?? 0) - row.start;
    worst = Math.max(worst, Math.abs(d));
    expect(Math.abs(d) <= 0.5, `${row.cue} starts at ${s2(cue?.start ?? 0)} s, doc says ${s2(row.start)} s`);
  }
  const docHeader = readFileSync(docFile(slug), "utf8").split("\n").find((l) => /^\|\s*Cue\s*\|/.test(l))?.trim();
  expect(cueTable(tl).split("\n")[0] === CUE_TABLE_HEADER && docHeader === CUE_TABLE_HEADER, "printed table header differs from the doc's six columns");
  out.push(`${doc.length}/${doc.length} cue starts within 0.5 s of docs/${slug}.md (largest gap ${s2(worst)} s)`);
  out.push(`npm run timeline prints: ${CUE_TABLE_HEADER}`);
  return out;
};

// 3 -------------------------------------------------------------------------
const checkFlash = (slug: string, tl: Timeline): string[] => {
  const c = tl.cues.find((x) => x.triggers.some((t) => t.id === "flash"));
  const trig = c?.triggers.find((t) => t.id === "flash");
  const line = c?.lines[0];
  expect(c !== undefined && trig !== undefined && line !== undefined, "no flash trigger in the timeline");
  if (c === undefined || trig === undefined || line === undefined || c.state.kind !== "roadtrain-side" || c.state.flash === null) {
    throw new Fail("flash cue is not a roadtrain-side cue with a flash");
  }
  const target =
    trig.source === "word"
      ? (line.words.find((w) => w.text.toLowerCase().startsWith("white"))?.start ?? trig.time)
      : line.start + 0.85 * (line.end - line.start);
  const firstWhite = Math.ceil(c.state.flash.at * tl.fps - 1e-6);
  const expected = Math.round(target * tl.fps);
  expect(Math.abs(firstWhite - expected) <= 3, `flash at frame ${firstWhite}, target frame ${expected}`);
  const video = outFile(`${slug}.master.mp4`);
  const before = meanLuma(frameRgb(video, firstWhite - 1));
  const at = meanLuma(frameRgb(video, firstWhite));
  expect(at > 245 && before < 200, `rendered luma ${before.toFixed(0)} → ${at.toFixed(0)} at the cut; expected a cut to white`);
  return [
    `"white" ${trig.source === "word" ? "onset" : "85% fallback (placeholder stamps are estimates)"} at ${s2(target)} s = frame ${expected}`,
    `first white frame ${firstWhite} (${s2(firstWhite / tl.fps)} s), ${Math.abs(firstWhite - expected)} frame(s) off; master luma ${before.toFixed(0)} → ${at.toFixed(0)}`,
  ];
};

// 4 -------------------------------------------------------------------------
const checkBangs = (slug: string, tl: Timeline): string[] => {
  const bangs = tl.cues.flatMap((c) => c.sfx).filter((s) => s.name === "bang").map((s) => s.start);
  const expected = [58.0, 59.4, 61.0];
  expect(bangs.length === 3, `${bangs.length} bangs in the timeline`);
  bangs.forEach((b, i) => expect(Math.abs(b - (expected[i] ?? 0)) <= 0.3, `bang ${i + 1} at ${s2(b)} s`));
  const lines = tl.cues.flatMap((c) => c.lines);
  let nearest = Infinity;
  for (const b of bangs) {
    for (const l of lines) {
      const gap = l.end <= b ? b - l.end : l.start >= b ? l.start - b : 0;
      nearest = Math.min(nearest, gap);
    }
  }
  expect(nearest >= 1, `narration within ${s2(nearest)} s of a bang`);
  const audio = decodeMono(outFile(`${slug}.master.mp4`));
  // A hit is a 10 dB jump over the last 150 ms: the bangs sit about 14 dB over the night drone.
  const found = onsets(audio, { riseDb: 10, floorDb: -30 });
  const heard = expected.map((t) => found.find((o) => Math.abs(o - t) <= 0.3) ?? null);
  heard.forEach((h, i) => expect(h !== null, `no hit heard within 0.3 s of ${expected[i]} s in the master's audio`));
  return [
    `timeline: ${bangs.map(s2).join(", ")} s; nearest narration ${s2(nearest)} s away`,
    `heard in the master's audio at ${heard.map((h) => s2(h ?? 0)).join(", ")} s`,
  ];
};

// 5 -------------------------------------------------------------------------
const checkHidden = (slug: string, tl: Timeline): string[] => {
  const frames: number[] = [];
  let tallest = 0;
  for (const target of TARGETS) {
    for (let f = 0; f < tl.frames; f++) {
      const r = readablesAt(tl, target, f).find((x) => x.name === READABLE.hiddenFigure);
      if (r === undefined) continue;
      if (target === "master") frames.push(f);
      tallest = Math.max(tallest, r.box.h);
      expect(contains(stageFor(target), r.box), `${target} frame ${f}: hidden figure leaves the stage`);
    }
  }
  const first = Math.min(...frames);
  const last = Math.max(...frames);
  const cut = tl.cues.find((c) => c.startFrame === last + 1);
  expect(Math.abs(first - 28 * tl.fps) <= 1, `hidden figure appears at frame ${first} (${s2(first / tl.fps)} s), not 28.0 s`);
  expect(Math.abs((last + 1) / tl.fps - 35) <= 1 / tl.fps && cut !== undefined && cut.scene !== "highway-walk", `hidden figure leaves at ${s2((last + 1) / tl.fps)} s, not at the 35.0 s cut`);
  expect(frames.length === last - first + 1, "hidden figure flickers");
  expect(tallest <= HIDDEN_FIGURE.maxHeight, `hidden figure is ${tallest.toFixed(1)} px tall`);
  const words = new RegExp(`\\b(${(tl.hidden?.words ?? []).join("|")})\\b`, "i");
  const mention = tl.captions.find((p) => words.test(p.rows.join(" ")));
  expect(mention === undefined, `caption mentions it: ${mention?.rows.join(" ")}`);
  // In the finished file: the figure's patch darkens when it appears.
  const video = outFile(`${slug}.master.mp4`);
  const patch = { x: HIDDEN_FIGURE.feet.x - 8, y: HIDDEN_FIGURE.feet.y - 38, w: 16, h: 36 };
  const before = meanLuma(frameRgb(video, first - 2), patch);
  const after = meanLuma(frameRgb(video, first + 2), patch);
  expect(before - after > 20, `figure patch luma ${before.toFixed(0)} → ${after.toFixed(0)}; expected it to darken`);
  return [
    `on screen frames ${first}–${last} (${s2(first / tl.fps)} s to the cut at ${s2((last + 1) / tl.fps)} s), at most ${tallest.toFixed(1)} px tall, inside every stage`,
    `never in captions; in the master its patch darkens ${before.toFixed(0)} → ${after.toFixed(0)} as it appears`,
  ];
};

// 6 -------------------------------------------------------------------------
const checkSafecheck = (slug: string): string[] => {
  const png = outFile(`${slug}.safecheck.png`);
  const json = outFile(`${slug}.safecheck.json`);
  expect(existsSync(png) && existsSync(json), `run npm run safecheck -- ${slug}`);
  const report = JSON.parse(readFileSync(json, "utf8")) as { passed: boolean; frames: unknown[]; measured: { target: string }[]; failures: unknown[] };
  expect(report.passed, `${report.failures.length} safe-zone failure(s)`);
  for (const p of PLATFORM_IDS) {
    const n = report.measured.filter((m) => m.target === p).length;
    expect(n === 4, `${p}: ${n} frames on the sheet`);
  }
  const img = readPng(png);
  return [`${png.replace(ROOT + "/", "")}: ${img.width} x ${img.height}, four frames for each of the five platforms (plus the master), no failures`];
};

// 7 -------------------------------------------------------------------------
const checkPixels = async (slug: string, tl: Timeline): Promise<string[]> => {
  const at = (s: number) => Math.round(s * tl.fps);
  const candidates = [1.43, 12.6, 16.6, 34.43, 40, 67.13, 72.0].map(at).filter((f) => f < tl.frames);
  const dir = verifyDir("pixels");
  const lines: string[] = [];
  let compared = 0;
  for (const frame of candidates) {
    const master = join(dir, `master.${frame}.png`);
    await renderEpisodeStill(episodeProps(slug, "master"), frame, master);
    const m = readPng(master);
    for (const p of PLATFORM_IDS) {
      const file = join(dir, `${p}.${frame}.png`);
      await renderEpisodeStill(episodeProps(slug, p), frame, file);
      const diff = diffOutside(m, readPng(file), stageFor(p));
      expect(diff === 0, `frame ${frame}: ${p} differs from the master in ${diff} pixel(s) outside its stage`);
      compared++;
    }
  }
  lines.push(`${compared} frame pairs (${candidates.length} frames × 5 platforms): identical pixels outside each platform's stage`);
  lines.push(`frames ${candidates.join(", ")} cover the card, captions on the flash, the jolt, the push, the radio, the handprint and the end card`);
  return lines;
};

// 8 -------------------------------------------------------------------------
const checkFixture = async (): Promise<string[]> => {
  npm("tts", "--", "fixture");
  npm("timeline", "--", "fixture");
  const { timeline: fx } = loadTimeline("fixture");
  const card = fx.cues.find((c) => c.synthetic);
  expect(card !== undefined && card.state.kind === "tally-card", "no tally card inserted");
  if (card === undefined || card.state.kind !== "tally-card") throw new Fail("no tally card");
  expect(Math.abs(card.duration - 1.2) < 1e-6, `card lasts ${card.duration} s`);
  expect(card.state.drawMarks.length === 1 && card.state.drawMarks[0] === 3, "the card does not draw the fourth mark");
  npm("render", "--", "fixture", "--platform", "master");
  const video = outFile("fixture.master.mp4");
  const geom = cardLayout(stageFor("master"), { dayText: null, marks: 4 });
  const fourth = geom.strokes[3];
  if (fourth === undefined) throw new Fail("no fourth stroke in the layout");
  const column = { x: fourth.x1 - 3, y: fourth.y1, w: 6, h: fourth.y2 - fourth.y1 };
  const delay = 6;
  const probes = [card.startFrame + delay - 1, card.startFrame + delay + 3, card.startFrame + delay + 7];
  const fractions = probes.map((f) => brightFraction(frameRgb(video, f), column));
  expect((fractions[0] ?? 1) < 0.1, `fourth stroke already showing before it draws (${(fractions[0] ?? 0).toFixed(2)})`);
  expect((fractions[1] ?? 0) > 0.2 && (fractions[1] ?? 1) < 0.8, `fourth stroke not part-drawn mid-way (${(fractions[1] ?? 0).toFixed(2)})`);
  expect((fractions[2] ?? 0) > 0.85, `fourth stroke not fully drawn (${(fractions[2] ?? 0).toFixed(2)})`);
  const firstThree = geom.strokes.slice(0, 3).map((s) => brightFraction(frameRgb(video, probes[0] ?? 0), { x: s.x1 - 3, y: s.y1, w: 6, h: s.y2 - s.y1 }));
  expect(firstThree.every((f) => f > 0.85), "the first three marks are not on the card from its first frame");
  // A strip for eyes: card start, part-drawn, drawn.
  const dir = verifyDir("fixture");
  const strip = probes.map((f, i) => {
    const file = join(dir, `card.${i}.png`);
    spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", "-i", video, "-vf", `select=eq(n\\,${f}),scale=360:640`, "-vsync", "0", "-frames:v", "1", file]);
    return readPng(file);
  });
  writePng(join(dir, "fixture-card.png"), tile([strip], 12, [40, 40, 40]));
  return [
    `fixture renders with no code changes: ${s2(fx.duration)} s, tally card at ${s2(card.start)}–${s2(card.end)} s (1.2 s) before F02`,
    `fourth stroke in the master: ${fractions.map((f) => f.toFixed(2)).join(" → ")} drawn at frames ${probes.join(", ")}; strip at out/verify/fixture/fixture-card.png`,
  ];
};

// 9 -------------------------------------------------------------------------
const checkStyle = (): string[] => {
  const g = spawnSync("grep", ["-rin", "eye\\|hand\\|foot\\|radial-gradient", join(ROOT, "src", "primitives")], { encoding: "utf8" });
  expect(g.stdout.trim() === "", `grep found:\n${g.stdout}`);
  const gradients = spawnSync("grep", ["-rlE", "linearGradient|radialGradient|linear-gradient|radial-gradient", join(ROOT, "src")], { encoding: "utf8" })
    .stdout.trim()
    .split("\n")
    .filter((x) => x !== "")
    .map((x) => x.replace(ROOT + "/", ""));
  expect(gradients.length === 1 && gradients[0] === "src/primitives/Sky.tsx", `gradients outside the dusk sky: ${gradients.join(", ")}`);
  const scenes = readdirSync(join(ROOT, "src", "scenes")).filter((f) => f.endsWith(".tsx"));
  const scaling = scenes.filter((f) => /scale\(\$\{/.test(readFileSync(join(ROOT, "src", "scenes", f), "utf8")));
  expect(scaling.length === 1 && scaling[0] === "HighwayWalk.tsx", `camera scaling outside the push: ${scaling.join(", ")}`);
  return [
    'grep -ri "eye\\|hand\\|foot\\|radial-gradient" src/primitives: no matches',
    "the only gradient in src is the dusk sky (src/primitives/Sky.tsx); the only scene that scales the camera is the highway push",
  ];
};

// 10 ------------------------------------------------------------------------
const checkNewEpisode = (): string[] => {
  // A copy of the Episode 1 script renamed to ep02, scaffolded and built from scratch.
  copyFileSync(docFile("ep01"), docFile("ep02"));
  const scaffold = npm("new-episode", "--", "docs/ep02.md", "--force");
  const timeline = npm("timeline", "--", "ep02");
  const lastLine = timeline.trim().split("\n").pop() ?? "";
  expect(lastLine.includes("out/ep02.timeline.json"), `npm run timeline -- ep02 did not finish cleanly: ${lastLine}`);
  const doc = /Against docs\/ep02\.md: ([^\n]+)/.exec(timeline)?.[1] ?? "no comparison printed";
  return [
    `npm run new-episode -- docs/ep02.md → ${scaffold.split("\n").find((l) => l.startsWith("✓ episodes/")) ?? "episodes/ep02.json"}`,
    `npm run timeline -- ep02 passes; ${doc}`,
  ];
};

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "ep01");
  npm("timeline", "--", slug);
  const { timeline } = loadTimeline(slug);
  const results: Result[] = [];
  const tests: [number, string, () => Promise<string[]> | string[]][] = [
    [1, "Master and variants: format, length, loudness", () => checkMaster(slug)],
    [2, "Cue starts match the doc; table in the doc's six columns", () => checkCueStarts(slug, timeline)],
    [3, "Cut to white lands on \"white\"", () => checkFlash(slug, timeline)],
    [4, "Bangs at 58.0, 59.4, 61.0 s in silence", () => checkBangs(slug, timeline)],
    [5, "Hidden figure: 28.0 s to the cut, ≤ 40 px, in stage, never captioned", () => checkHidden(slug, timeline)],
    [6, "Safe-zone contact sheet passes", () => checkSafecheck(slug)],
    [7, "Variants identical to the master outside the stage", () => checkPixels(slug, timeline)],
    [8, "Fixture: tally change 3 → 4 draws the fourth stroke", () => checkFixture()],
    [9, "No eyes, hands, feet or extra gradients; push is the only camera move", () => checkStyle()],
    [10, "new-episode on a renamed copy of docs/ep01.md passes the timeline", () => checkNewEpisode()],
  ];
  for (const [id, name, fn] of tests) {
    process.stdout.write(`${id}. ${name} … `);
    try {
      const details = await fn();
      results.push({ id, name, pass: true, details });
      console.log("✓");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ id, name, pass: false, details: [msg] });
      console.log("✗");
    }
    for (const d of results[results.length - 1]?.details ?? []) console.log(`     ${d}`);
  }
  await closeBrowser();
  const dir = verifyDir();
  writeFileSync(join(dir, `${slug}.json`), JSON.stringify({ episode: slug, results }, null, 2) + "\n");
  const failed = results.filter((r) => !r.pass);
  if (existsSync(outFile(`${slug}.safecheck.png`))) copyFileSync(outFile(`${slug}.safecheck.png`), join(dir, `${slug}.safecheck.png`));
  if (failed.length > 0) throw new Error(`${failed.length} acceptance test(s) failed: ${failed.map((f) => f.id).join(", ")}`);
  console.log(`\n✓ all ${results.length} acceptance tests pass (out/verify/${slug}.json)`);
});

