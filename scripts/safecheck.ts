/**
 * npm run safecheck -- <episode>
 *
 * Proves every readable element clears every platform's interface, two ways:
 *
 * 1. A sweep of every frame of every target, using the layout functions the
 *    components draw with (src/readables.ts).
 * 2. Four rendered frames per target (the DAY card, the highway walk with the
 *    hidden figure, the night exterior with the handprint, the end card),
 *    with the debug overlay on. The page measures each readable element's
 *    painted box and logs it; those measured boxes are checked too, and must
 *    agree with the sweep's.
 *
 * Writes out/<episode>.safecheck.png (one row per target, four frames each:
 * interface bands in red, stage dashed, readable boxes green or red) and
 * out/<episode>.safecheck.json. Exits non-zero on any failure.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROBE_PREFIX, type ProbeReport } from "../src/debug/ProbeReport";
import { contains, intersects, type Box } from "../src/layout";
import type { Timeline } from "../src/lib/timeline";
import { blockedZonesFor, PLATFORM_IDS, platformConfig, stageFor, type TargetId } from "../src/platforms";
import { readablesAt } from "../src/readables";
import { READABLE } from "../src/scenes/common";
import { main, parseArgs } from "./lib/args";
import { loadTimeline } from "./lib/inputs";
import { outFile, slugOf, tmpDir } from "./lib/paths";
import { downscale, readPng, tile, writePng } from "./lib/png";
import { closeBrowser, episodeProps, renderEpisodeStill } from "./lib/remotion";

const TARGETS: readonly TargetId[] = ["master", ...PLATFORM_IDS];
/** Measured boxes may exceed the layout model by this much before the sweep is distrusted. */
const MODEL_TOLERANCE = 6;

type Pick = { key: string; label: string; frame: number; expect: string };

const captionMidIn = (tl: Timeline, from: number, to: number): number | null => {
  const page = tl.captions.find((p) => p.end > from && p.start < to);
  if (page === undefined) return null;
  return Math.round(((Math.max(page.start, from) + Math.min(page.end, to)) / 2) * tl.fps);
};

/** The four frames the contact sheet shows, found from the timeline rather than typed. */
export const pickFrames = (tl: Timeline): Pick[] => {
  const fps = tl.fps;
  const picks: Pick[] = [];
  const card = tl.cues.find((c) => c.state.kind === "day-card");
  if (card !== undefined && card.state.kind === "day-card") {
    const drawn = card.startFrame + card.state.marks * 6 + 1;
    const mid = captionMidIn(tl, card.start, card.end) ?? drawn;
    picks.push({ key: "card", label: "DAY card", frame: Math.min(card.endFrame - 1, Math.max(drawn, mid)), expect: READABLE.dayCard });
  }
  const hiddenCues = tl.cues.filter((c) => c.state.kind === "highway-walk" && c.state.hidden !== null);
  const firstHidden = hiddenCues[0];
  const lastHidden = hiddenCues[hiddenCues.length - 1];
  if (firstHidden !== undefined && lastHidden !== undefined && firstHidden.state.kind === "highway-walk" && firstHidden.state.hidden !== null) {
    const from = Math.ceil(firstHidden.state.hidden.from * fps);
    const to = lastHidden.endFrame - 1;
    let frame = to;
    for (let f = to; f >= from; f--) {
      const t = f / fps;
      if (tl.captions.some((p) => t >= p.start && t < p.end)) {
        frame = f;
        break;
      }
    }
    picks.push({ key: "hidden", label: "Hidden figure", frame, expect: READABLE.hiddenFigure });
  }
  const printCue = tl.cues.find((c) => c.state.kind === "cab-exterior-night" && c.state.printFrom !== null);
  if (printCue !== undefined && printCue.state.kind === "cab-exterior-night" && printCue.state.printFrom !== null) {
    const from = printCue.state.printFrom;
    const frame = captionMidIn(tl, from, printCue.end) ?? Math.round(((from + printCue.end) / 2) * fps);
    picks.push({ key: "print", label: "Handprint", frame, expect: READABLE.print });
  }
  const end = tl.cues.find((c) => c.state.kind === "end-card");
  if (end !== undefined) picks.push({ key: "end", label: "End card", frame: end.startFrame, expect: READABLE.endCard });
  return picks;
};

type Failure = { target: TargetId; frame: number; name: string; why: string };

const checkBox = (target: TargetId, frame: number, name: string, box: Box): Failure[] => {
  const out: Failure[] = [];
  for (const z of blockedZonesFor(target)) {
    if (intersects(box, z)) out.push({ target, frame, name, why: `overlaps the interface band at ${fmtBox(z)}` });
  }
  if (!contains(stageFor(target), box, 0.5)) out.push({ target, frame, name, why: `leaves the stage ${fmtBox(stageFor(target))}` });
  return out;
};

const fmtBox = (b: Box): string => `x ${Math.round(b.x)}–${Math.round(b.x + b.w)}, y ${Math.round(b.y)}–${Math.round(b.y + b.h)}`;

main(async () => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "");
  if (slug === "") throw new Error("Usage: npm run safecheck -- <episode>");
  const { timeline, problems } = loadTimeline(slug);
  const errors = problems.filter((p) => p.level === "error");
  if (errors.length > 0) throw new Error(`timeline has ${errors.length} error(s); run npm run timeline -- ${slug}`);

  const failures: Failure[] = [];

  // 1. Every frame, every target, from the layout model.
  let swept = 0;
  for (const target of TARGETS) {
    for (let f = 0; f < timeline.frames; f++) {
      for (const r of readablesAt(timeline, target, f)) {
        failures.push(...checkBox(target, f, r.name, r.box));
        swept++;
      }
    }
  }
  console.log(`Sweep: ${swept} readable boxes across ${timeline.frames} frames × ${TARGETS.length} targets.`);

  // 2. Four rendered frames per target, measured in the page.
  const picks = pickFrames(timeline);
  const dir = tmpDir("safecheck", slug);
  const rows: { target: TargetId; files: string[] }[] = [];
  const measured: { target: TargetId; pick: string; frame: number; items: ProbeReport["items"] }[] = [];
  for (const target of TARGETS) {
    const files: string[] = [];
    for (const pick of picks) {
      const props = { ...episodeProps(slug, target, true), debugLabel: `${pick.label} · ${(pick.frame / timeline.fps).toFixed(2)} s` };
      const file = join(dir, `${target}.${pick.key}.png`);
      const logs = await renderEpisodeStill(props, pick.frame, file);
      const line = logs.find((l) => l.startsWith(PROBE_PREFIX));
      if (line === undefined) throw new Error(`${target} ${pick.key}: the page did not report readable boxes`);
      const report = JSON.parse(line.slice(PROBE_PREFIX.length)) as ProbeReport;
      measured.push({ target, pick: pick.key, frame: pick.frame, items: report.items });
      if (!report.items.some((i) => i.name === pick.expect)) {
        failures.push({ target, frame: pick.frame, name: pick.expect, why: "expected on this frame but not found" });
      }
      const model = readablesAt(timeline, target, pick.frame);
      for (const item of report.items) {
        failures.push(...checkBox(target, pick.frame, `${item.name} (measured)`, item.box));
        const predicted = model.find((m) => m.name === item.name);
        if (predicted === undefined) {
          failures.push({ target, frame: pick.frame, name: item.name, why: "rendered but missing from the layout model" });
        } else if (!contains(predicted.box, item.box, MODEL_TOLERANCE)) {
          failures.push({
            target,
            frame: pick.frame,
            name: item.name,
            why: `measured ${fmtBox(item.box)} exceeds the layout model's ${fmtBox(predicted.box)} by more than ${MODEL_TOLERANCE} px`,
          });
        }
      }
      files.push(file);
      process.stdout.write(".");
    }
    rows.push({ target, files });
  }
  await closeBrowser();
  process.stdout.write("\n");

  // Contact sheet: one row per target, four frames each, a third of full size.
  const sheet = tile(
    rows.map((r) => r.files.map((f) => downscale(readPng(f), 3))),
    16,
    [40, 40, 40],
  );
  writePng(outFile(`${slug}.safecheck.png`), sheet);
  writeFileSync(
    outFile(`${slug}.safecheck.json`),
    JSON.stringify(
      {
        episode: slug,
        targets: TARGETS.map((t) => ({ id: t, label: platformConfig(t).label, stage: stageFor(t), blocked: blockedZonesFor(t) })),
        frames: picks,
        measured,
        failures,
        passed: failures.length === 0,
      },
      null,
      2,
    ) + "\n",
  );

  for (const target of TARGETS) {
    const n = failures.filter((f) => f.target === target).length;
    console.log(`  ${n === 0 ? "✓" : "✗"} ${platformConfig(target).label.padEnd(20)} ${n === 0 ? "clear" : `${n} problem(s)`}`);
  }
  if (failures.length > 0) {
    for (const f of failures.slice(0, 30)) console.log(`    ${f.target} frame ${f.frame} ${f.name}: ${f.why}`);
    throw new Error(`safe-zone check failed: ${failures.length} problem(s). See out/${slug}.safecheck.png and .json`);
  }
  console.log(`✓ out/${slug}.safecheck.png: every readable element clears every interface`);
});
