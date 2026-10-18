import { describeCue, type Timeline, type TimelineCue } from "../../src/lib/timeline";

/** Reads the cue table out of an episode's markdown script. */
export type CueRow = {
  cue: string;
  start: number;
  dur: number;
  visual: string;
  narration: string;
  sound: string;
};

const cells = (line: string): string[] =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split(/(?<!\\)\|/)
    .map((c) => c.trim());

/** The first table whose header begins "Cue | Start". */
export const parseCueTable = (markdown: string): CueRow[] => {
  const lines = markdown.split(/\r?\n/);
  const headerAt = lines.findIndex((l) => /^\|\s*Cue\s*\|\s*Start/i.test(l));
  if (headerAt < 0) throw new Error('No cue table found (expected a header row starting "| Cue | Start (s) |")');
  const rows: CueRow[] = [];
  for (let i = headerAt + 2; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (!line.trim().startsWith("|")) break;
    const c = cells(line);
    if (c.length < 6) throw new Error(`Cue table row ${i + 1} has ${c.length} columns, expected 6: ${line}`);
    const start = Number(c[1]);
    const dur = Number(c[2]);
    if (!Number.isFinite(start) || !Number.isFinite(dur)) throw new Error(`Cue table row ${i + 1}: start and duration must be numbers`);
    rows.push({ cue: c[0] ?? "", start, dur, visual: c[3] ?? "", narration: c[4] ?? "", sound: c[5] ?? "" });
  }
  return rows;
};

// ---------------------------------------------------------------------------
// Printing a timeline back out in the doc's six columns
// ---------------------------------------------------------------------------

export const CUE_TABLE_HEADER = "| Cue | Start (s) | Dur (s) | Visual | Narration | Sound and radio |";

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
  const head = `${CUE_TABLE_HEADER}\n| --- | --- | --- | --- | --- | --- |`;
  const rows = tl.cues.map(
    (c) =>
      `| ${c.id} | ${s1(c.start)} | ${s1(c.duration)} | ${esc(describeCue(c))} | ${esc(narrationCell(c))} | ${esc(soundCell(c))} |`,
  );
  return [head, ...rows].join("\n");
};

