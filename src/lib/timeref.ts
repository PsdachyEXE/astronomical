/**
 * Time references: how an episode pins a moment inside a cue to something
 * measured rather than typed.
 *
 *   2.0               2.0 s after the cue starts (may be negative)
 *   "start", "end"    the cue's start or end
 *   "trigger:flash"   the moment a trigger fires (a word's onset)
 *   "line:1:end"      the start or end of narration line 1 of the cue
 *   "sfx:bang#0"      the start of the first "bang" effect in the cue
 *
 * Any string form may carry an offset: "trigger:flash+0.2", "end-1.5".
 */

export const TIME_REF_PATTERN =
  /^(start|end|trigger:[\w-]+|line:\d+:(?:start|end)|sfx:[\w-]+(?:#\d+)?)([+-]\d+(?:\.\d+)?)?$/;

export type Anchor =
  | { kind: "start" }
  | { kind: "end" }
  | { kind: "trigger"; id: string }
  | { kind: "line"; index: number; edge: "start" | "end" }
  | { kind: "sfx"; file: string; index: number };

export type ParsedTimeRef = { anchor: Anchor; offset: number };

export const parseTimeRef = (ref: number | string): ParsedTimeRef => {
  if (typeof ref === "number") return { anchor: { kind: "start" }, offset: ref };
  const m = TIME_REF_PATTERN.exec(ref);
  if (m === null) throw new Error(`Not a time reference: "${ref}"`);
  const head = m[1] ?? "";
  const offset = m[2] === undefined ? 0 : Number(m[2]);
  if (head === "start" || head === "end") return { anchor: { kind: head }, offset };
  const [kind, ...rest] = head.split(":");
  if (kind === "trigger") return { anchor: { kind: "trigger", id: rest.join(":") }, offset };
  if (kind === "line") {
    return {
      anchor: { kind: "line", index: Number(rest[0]), edge: rest[1] === "end" ? "end" : "start" },
      offset,
    };
  }
  const [file, index] = rest.join(":").split("#");
  return { anchor: { kind: "sfx", file: file ?? "", index: index === undefined ? 0 : Number(index) }, offset };
};

/** What a reference can be resolved against: one cue, with absolute times in seconds. */
export type RefContext = {
  cueId: string;
  start: number;
  /** Null while the cue's own length is still being worked out. */
  end: number | null;
  lines: readonly { start: number; end: number }[];
  triggers: ReadonlyMap<string, number>;
  /** Start times of the cue's effects so far, per file, in order. */
  sfx: ReadonlyMap<string, readonly number[]>;
};

/** Resolves a reference to absolute seconds, or throws naming the cue and the reference. */
export const resolveTimeRef = (ref: number | string, ctx: RefContext): number => {
  const { anchor, offset } = parseTimeRef(ref);
  const fail = (why: string): never => {
    throw new Error(`${ctx.cueId}: time reference ${JSON.stringify(ref)} ${why}`);
  };
  switch (anchor.kind) {
    case "start":
      return ctx.start + offset;
    case "end":
      return ctx.end === null ? fail("uses the cue end before the cue's length is known") : ctx.end + offset;
    case "trigger": {
      const t = ctx.triggers.get(anchor.id);
      return t === undefined ? fail(`names trigger "${anchor.id}", which this cue does not have`) : t + offset;
    }
    case "line": {
      const line = ctx.lines[anchor.index];
      return line === undefined
        ? fail(`names line ${anchor.index}, but the cue has ${ctx.lines.length} lines`)
        : line[anchor.edge] + offset;
    }
    case "sfx": {
      const times = ctx.sfx.get(anchor.file);
      const t = times?.[anchor.index];
      return t === undefined
        ? fail(`names effect ${anchor.file}#${anchor.index}, which is not placed earlier in this cue`)
        : t + offset;
    }
  }
};
