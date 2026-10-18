/**
 * npm run timeline -- <episode>
 *
 * Builds the absolute timeline from the episode JSON and timing.json, writes
 * out/<episode>.timeline.json, prints the cue table in the doc's six columns,
 * and fails if the runtime leaves 62 to 170 s or any episode rule breaks.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describeCue, type Timeline, type TimelineCue } from "../src/lib/timeline";
import { main, parseArgs } from "./lib/args";
import { parseCueTable } from "./lib/cue-table";
import { loadTimeline } from "./lib/inputs";
import { docFile, outFile, slugOf } from "./lib/paths";

const s1 = (x: number): string => x.toFixed(1);

const narrationCell = (c: TimelineCue): string => {
  if (c.lines.length === 0) return c.synthetic ? "None." : "None, by design.";
  return c.lines
    .map((l, i) => {
      const prev = c.lines[i - 1];
      const pause = prev === undefined ? l.start - c.start : l.start - prev.end;
      const lead = i === 0 ? (Math.abs(pause - 0.4) > 0.01 ? `Pause ${s1(pause)} s. ` : "") : `Pause ${s1(pause)} s. `;
      return `${lead}${l.radio ? "Radio: " : ""}"${l.text}"`;
    })
    .join(" ");
};

const soundCell = (c: TimelineCue): string => {
  if (c.sfx.length === 0) return "Silence";
  const groups = new Map<string, typeof c.sfx>();
  for (const ev of c.sfx) groups.set(ev.name, [...(groups.get(ev.name) ?? []), ev]);
  return [...groups.entries()]
    .map(([name, evs]) => {
      const first = evs[0];
      if (first === undefined) return "";
      if (first.kind === "bed") return `${name} ${s1(first.start)}–${s1(first.end)} s`;
      if (first.kind === "clip") return `${name} replayed ${s1(first.start)}–${s1(first.end)} s at ${first.gainTo} dB`;
      if (evs.length > 3) return `${name} ×${evs.length} from ${s1(first.start)} s`;
      return `${name} at ${evs.map((e) => s1(e.start)).join(", ")} s`;
    })
    .join("; ");
};

const esc = (s: string): string => s.replace(/\|/g, "\\|");

export const cueTable = (tl: Timeline): string => {
  const head = "| Cue | Start (s) | Dur (s) | Visual | Narration | Sound and radio |\n| --- | --- | --- | --- | --- | --- |";
  const rows = tl.cues.map(
    (c) =>
      `| ${c.id} | ${s1(c.start)} | ${s1(c.duration)} | ${esc(describeCue(c))} | ${esc(narrationCell(c))} | ${esc(soundCell(c))} |`,
  );
  return [head, ...rows].join("\n");
};

main(() => {
  const args = parseArgs(process.argv.slice(2));
  const slug = slugOf(args.positional[0] ?? "");
  if (slug === "") throw new Error("Usage: npm run timeline -- <episode>");
  const { timeline, problems } = loadTimeline(slug);
  writeFileSync(outFile(`${slug}.timeline.json`), JSON.stringify({ ...timeline, problems }, null, 2) + "\n");

  console.log(`\n${slug.toUpperCase()}: DAY ${timeline.day}, runtime ${timeline.duration.toFixed(2)} s, ${timeline.cues.length} cues, ${timeline.words.narrator} narrator words, ${timeline.words.radio} radio words\n`);
  console.log(cueTable(timeline));

  if (existsSync(docFile(slug))) {
    try {
      const doc = parseCueTable(readFileSync(docFile(slug), "utf8"));
      const deltas = doc
        .map((row) => {
          const cue = timeline.cues.find((c) => c.id === row.cue);
          return cue === undefined ? null : { id: row.cue, d: cue.start - row.start };
        })
        .filter((x): x is { id: string; d: number } => x !== null);
      const worst = deltas.reduce((w, x) => (Math.abs(x.d) > Math.abs(w.d) ? x : w), { id: "-", d: 0 });
      const within = deltas.filter((x) => Math.abs(x.d) <= 0.5).length;
      const gap = Math.abs(worst.d) < 0.005 ? "every start exact" : `largest gap ${worst.d >= 0 ? "+" : ""}${worst.d.toFixed(2)} s at ${worst.id}`;
      console.log(`\nAgainst docs/${slug}.md: ${within}/${doc.length} cue starts within 0.5 s; ${gap}.`);
    } catch (e) {
      console.log(`\n(docs/${slug}.md has no readable cue table: ${e instanceof Error ? e.message : String(e)})`);
    }
  }

  for (const p of problems) console.log(`${p.level === "error" ? "✗" : "!"} [${p.code}] ${p.message}`);
  const errors = problems.filter((p) => p.level === "error");
  if (errors.length > 0) throw new Error(`${errors.length} problem(s) in ${slug}; out/${slug}.timeline.json written for inspection`);
  console.log(`\n✓ out/${slug}.timeline.json`);
});
