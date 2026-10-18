/**
 * npm run timeline -- <episode>
 *
 * Builds the absolute timeline from the episode JSON and timing.json, writes
 * out/<episode>.timeline.json, prints the cue table in the doc's six columns,
 * and fails if the runtime leaves 62 to 170 s or any episode rule breaks.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { main, parseArgs } from "./lib/args";
import { cueTable, parseCueTable } from "./lib/cue-table";
import { loadTimeline } from "./lib/inputs";
import { docFile, outFile, slugOf } from "./lib/paths";

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
