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
