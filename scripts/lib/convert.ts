/**
 * Markdown script → episode JSON scaffold.
 *
 * Reads the cue table (Cue | Start | Dur | Visual | Narration | Sound and
 * radio) and the "Sync points" notes, and writes the episode file the
 * renderer needs. It understands the vocabulary the bible and Episode 1 use
 * (scenes, times of day, the flash, the push, the hidden detail, the door,
 * the dawn, the effects library); anything it cannot place is kept in the
 * cue's `notes` and listed in the report, so Episode N is a writing task:
 * write the table, run this, read the report, adjust the JSON.
 *
 * It also turns the table's timings into directions: each cue's narration
 * gets the smallest pace (in 0.05 steps) at which the voice's natural rate
 * fits the cue's target duration, and a line that would land within an
 * effect's required silence waits until it clears.
 */
import type { EpisodeInput } from "../../src/lib/episode";
import { isSfxId, type SfxId } from "../../src/sfx";
import { estimateSeconds, isVoiceId, normaliseWord, wordsOf, type VoiceId } from "../../src/voices";
import { parseCueTable, type CueRow } from "./cue-table";

type Raw = Record<string, unknown>;
type CueOut = EpisodeInput["cues"][number];
type SfxOut = NonNullable<CueOut["sfx"]>[number];
type LineOut = NonNullable<CueOut["narration"]>[number];
type TriggerOut = NonNullable<CueOut["triggers"]>[number];

export type ConvertReport = { guesses: string[]; unparsed: string[] };

const NUMBER_WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20,
};
const numberFrom = (word: string): number | null => {
  const w = word.toLowerCase();
  if (/^\d+$/.test(w)) return Number(w);
  return NUMBER_WORDS[w] ?? null;
};

/** Default levels per effect, matching Episode 1's mix. */
const GAIN: Record<SfxId, number> = {
  click: -14, rumble: -20, glass: -8, boom: 0, ring: -18, footstep: -10, wind: -20,
  "static-sweep": -14, "static-bed": -26, bang: -2, drone: -14,
};
/** Effects that visual events can be pinned to. */
const EVENT_SOUNDS: readonly SfxId[] = ["click", "glass", "boom", "bang", "static-sweep"];

const SOUND_WORDS: readonly [RegExp, SfxId][] = [
  [/static sweep/i, "static-sweep"],
  [/static bed|static\b/i, "static-bed"],
  [/\bclicks?\b/i, "click"],
  [/\brumble\b/i, "rumble"],
  [/\bglass\b/i, "glass"],
  [/\bboom\b/i, "boom"],
  [/\bring\b/i, "ring"],
  [/\bfootsteps?\b/i, "footstep"],
  [/\bwind\b/i, "wind"],
  [/\bbangs?\b/i, "bang"],
  [/\bdrone\b/i, "drone"],
];

const r1 = (x: number): number => Math.round(x * 100) / 100;
const times = (text: string): number[] => {
  const m = /\bat ((?:\d+(?:\.\d+)?)(?:\s*(?:,|and)\s*\d+(?:\.\d+)?)*)(?:\s*s\b)?/i.exec(text);
  return m === null ? [] : (m[1] ?? "").split(/\s*(?:,|and)\s*/).map(Number);
};
const timeAfter = (text: string, phrase: RegExp): number | null => {
  const m = new RegExp(`${phrase.source}\\s*(\\d+(?:\\.\\d+)?)\\s*s\\b`, "i").exec(text);
  return m === null ? null : Number(m[1]);
};

type SyncRules = {
  leadIn: number;
  leadInExceptions: Map<string, number>;
  wordTriggers: { cue: string; word: string; fallback: number }[];
  pitch: Map<SfxId, number>;
  silentAround: Set<SfxId>;
};

const readSync = (markdown: string): SyncRules => {
  const rules: SyncRules = { leadIn: 0.4, leadInExceptions: new Map(), wordTriggers: [], pitch: new Map(), silentAround: new Set() };
  const lead = /Narration starts (\d+(?:\.\d+)?) s after its cue begins(?:, except ([^.]*(?:\.\d+[^.]*)*))?/i.exec(markdown);
  if (lead !== null) {
    rules.leadIn = Number(lead[1]);
    for (const m of (lead[2] ?? "").matchAll(/(\w+), which waits (\d+(?:\.\d+)?) s/g)) {
      rules.leadInExceptions.set(m[1] ?? "", Number(m[2]));
    }
  }
  const fallback = /fire at (\d+)% of that clip/i.exec(markdown);
  for (const m of markdown.matchAll(/onset of the word "([^"]+)" in (\w+)/gi)) {
    rules.wordTriggers.push({ cue: m[2] ?? "", word: m[1] ?? "", fallback: fallback === null ? 0.85 : Number(fallback[1]) / 100 });
  }
  for (const m of markdown.matchAll(/(\w+)s? are one sample played \w+ times with (\d+)% pitch variance/gi)) {
    const id = (m[1] ?? "").toLowerCase().replace(/s$/, "");
    if (isSfxId(id)) rules.pitch.set(id, Number(m[2]) / 100);
  }
  for (const m of markdown.matchAll(/The (\w+?)s? sit in silence/gi)) {
    const id = (m[1] ?? "").toLowerCase();
    if (isSfxId(id)) rules.silentAround.add(id);
  }
  return rules;
};

type Ctx = {
  row: CueRow;
  start: number;
  end: number;
  prevScene: string | null;
  sky: "day" | "drained" | "dusk" | "night";
  duskMix: number;
  lastRadioClip: string | null;
  report: ConvertReport;
  rules: SyncRules;
};

const rel = (ctx: Ctx, abs: number): number | string => {
  if (Math.abs(abs - ctx.end) < 0.01) return "end";
  return r1(abs - ctx.start);
};

/** Pins an absolute moment to an event sound placed at (or just before) it in the same cue. */
const pin = (ctx: Ctx, abs: number, sfx: SfxOut[]): number | string => {
  const counts = new Map<string, number>();
  let best: { ref: string; off: number } | null = null;
  for (const s of sfx) {
    if (s.file === undefined || !EVENT_SOUNDS.includes(s.file as SfxId)) continue;
    const k = counts.get(s.file) ?? 0;
    counts.set(s.file, k + 1);
    const at = typeof s.at === "number" ? ctx.start + s.at : s.at === "end" ? ctx.end : null;
    if (at === null) continue;
    const off = r1(abs - at);
    if (off >= -0.01 && off <= 0.5 && (best === null || off < best.off)) best = { ref: `sfx:${s.file}#${k}`, off };
  }
  if (best === null) return rel(ctx, abs);
  return best.off < 0.01 ? best.ref : `${best.ref}+${best.off}`;
};

const readSound = (ctx: Ctx, triggers: TriggerOut[]): SfxOut[] => {
  const text = ctx.row.sound.trim();
  const out: SfxOut[] = [];
  if (/^silence\.?$/i.test(text) || text === "") return out;
  const sentences = text.split(/(?<=\.)\s+|(?<=\d)\.\s*$/).map((s) => s.replace(/\.$/, "").trim()).filter((s) => s !== "");
  for (const sentence of sentences) {
    // Commas start a new sound only when the next fragment names one.
    const clauses: string[] = [];
    for (const part of sentence.split(/,\s*/)) {
      const names = SOUND_WORDS.some(([re]) => re.test(part)) && !/^cut by/i.test(part);
      if (clauses.length > 0 && !names) clauses[clauses.length - 1] += `, ${part}`;
      else clauses.push(part);
    }
    for (const clause of clauses) {
      if (/flash itself is silent/i.test(clause)) continue;
      if (/loop restarts/i.test(clause)) {
        const cut = timeAfter(clause, /cut by a click at/);
        if (ctx.lastRadioClip === null) {
          ctx.report.unparsed.push(`${ctx.row.cue}: "${clause}" (no earlier radio line to replay)`);
          continue;
        }
        out.push({ clip: ctx.lastRadioClip, at: 0, ...(cut === null ? { until: "end" } : { until: rel(ctx, cut) }), gain: /half volume/i.test(clause) ? -6 : -10 });
        if (cut !== null) out.push({ file: "click", at: rel(ctx, cut), gain: GAIN.click });
        continue;
      }
      const hit = SOUND_WORDS.find(([re]) => re.test(clause));
      if (hit === undefined) {
        ctx.report.unparsed.push(`${ctx.row.cue}: sound "${clause}"`);
        continue;
      }
      const id = hit[1];
      const base: SfxOut = { file: id, gain: GAIN[id] };
      const pitch = ctx.rules.pitch.get(id);
      if (pitch !== undefined) base.pitch = pitch;
      if (ctx.rules.silentAround.has(id)) base.clear = 1.0;
      const bed = ["rumble", "wind", "static-bed", "drone"].includes(id);

      if (/cuts dead at the flash/i.test(clause)) {
        const flash = triggers.find((t) => t.id === "flash");
        out.push({ ...base, at: 0, until: flash === undefined ? "end" : "trigger:flash", gainFrom: base.gain, gain: (base.gain ?? 0) + 12 });
        continue;
      }
      const every = /every (\d+(?:\.\d+)?) s/i.exec(clause);
      const stop = timeAfter(clause, /stops? at/);
      if (every !== null || (id === "footstep" && stop !== null)) {
        out.push({ ...base, every: every === null ? 0.8 : Number(every[1]), ...(stop === null ? {} : { until: rel(ctx, stop) }) });
        continue;
      }
      const fadeInFrom = timeAfter(clause, /fades in from/);
      const from = fadeInFrom ?? timeAfter(clause, /\bfrom/);
      const fadeOutBy = timeAfter(clause, /(?:fades out|fading to silence|fading out) by/);
      const at = times(clause.replace(/(?:fades out|fading to silence|fading out) by.*$/i, ""));
      if (bed || fadeOutBy !== null || from !== null) {
        const startAbs = from ?? (at[0] !== undefined && !bed ? at[0] : ctx.start);
        const entry: SfxOut = { ...base, at: startAbs === ctx.start ? 0 : r1(startAbs - ctx.start) };
        entry.until = fadeOutBy === null ? "end" : rel(ctx, fadeOutBy);
        if (fadeOutBy !== null) entry.fadeOut = r1(fadeOutBy - Math.max(startAbs, ctx.start));
        if (fadeInFrom !== null) {
          if (/rises/i.test(clause)) {
            entry.gainFrom = -40;
            entry.fadeIn = 0.5;
          } else entry.fadeIn = 2.0;
        }
        out.push(entry);
        continue;
      }
      if (at.length === 0) {
        ctx.report.guesses.push(`${ctx.row.cue}: "${clause}" has no time; placed at the cue start`);
        out.push({ ...base, at: 0 });
        continue;
      }
      for (const t of at) out.push({ ...base, at: rel(ctx, t) });
    }
  }
  return out;
};

const readNarration = (ctx: Ctx, radioVoice: VoiceId): LineOut[] => {
  const text = ctx.row.narration.replace(/[“”]/g, '"');
  if (/^none\b/i.test(text.trim())) return [];
  const lines: LineOut[] = [];
  let pending: number | null = null;
  for (const m of text.matchAll(/(Radio:\s*)?"([^"]+)"|Pause (\d+(?:\.\d+)?) s\.?/g)) {
    if (m[3] !== undefined) {
      pending = Number(m[3]);
      continue;
    }
    const first = lines.length === 0;
    const pause = pending ?? (first ? (ctx.rules.leadInExceptions.get(ctx.row.cue) ?? ctx.rules.leadIn) : 0.4);
    if (!first && pending === null) ctx.report.guesses.push(`${ctx.row.cue}: no pause marked between lines; used 0.4 s`);
    lines.push({ voice: m[1] !== undefined ? radioVoice : "cal", text: (m[2] ?? "").trim(), pauseBefore: pause });
    pending = null;
  }
  if (lines.length === 0) ctx.report.unparsed.push(`${ctx.row.cue}: narration "${text}" has no quoted line`);
  return lines;
};

const sceneOf = (ctx: Ctx): { scene: string; cut: boolean } => {
  const v = ctx.row.visual;
  const cut = /^cut\b/i.test(v);
  const same = /^(same|hold)\b/i.test(v) || /\bsame (wide|shot)\b/i.test(v);
  if (/\bDAY \d+\b/.test(v) && /tally stroke/i.test(v)) return { scene: "day-card", cut };
  if (/^black\./i.test(v) && /(tally stroke|fades to nothing)/i.test(v)) return { scene: "end-card", cut };
  if (/^black\./i.test(v)) return { scene: "black-slit", cut };
  if (same && ctx.prevScene !== null) return { scene: ctx.prevScene, cut: false };
  if (/side-on/i.test(v) && /trailer/i.test(v)) return { scene: "roadtrain-side", cut };
  if (/highway/i.test(v)) return { scene: "highway-walk", cut };
  if (/cab interior/i.test(v)) return { scene: "cab-interior", cut };
  if (/exterior/i.test(v) && /night/i.test(v)) return { scene: "cab-exterior-night", cut };
  ctx.report.guesses.push(`${ctx.row.cue}: scene not recognised; continued ${ctx.prevScene ?? "black-slit"}`);
  return { scene: ctx.prevScene ?? "black-slit", cut };
};

/** "On the word "white" the frame cuts to flash white and holds 0.9 s." → a word trigger. */
const flashTrigger = (ctx: Ctx): TriggerOut | null => {
  const flash = /On the word "([^"]+)" the frame cuts to flash white(?: and holds (\d+(?:\.\d+)?) s)?/i.exec(ctx.row.visual);
  if (flash === null) return null;
  const rule = ctx.rules.wordTriggers.find((w) => w.cue === ctx.row.cue);
  return { id: "flash", line: 0, word: flash[1] ?? "", fallback: rule?.fallback ?? 0.85, hold: flash[2] === undefined ? 0.9 : Number(flash[2]) };
};

const readState = (ctx: Ctx, scene: string, sfx: SfxOut[], lines: LineOut[], triggers: TriggerOut[]): Raw => {
  const v = ctx.row.visual;
  const s: Raw = {};
  const isFirstOfShot = scene !== ctx.prevScene;
  switch (scene) {
    case "black-slit": {
      const slit = /At (\d+(?:\.\d+)?) s[^.]*slit of light/i.exec(v);
      if (slit !== null) s.slit = { at: rel(ctx, Number(slit[1])) };
      break;
    }
    case "roadtrain-side": {
      if (/day palette/i.test(v) && !/drained/i.test(v)) ctx.sky = "day";
      if (/drained/i.test(v)) ctx.sky = "drained";
      if (isFirstOfShot || /palette/i.test(v)) s.sky = { from: ctx.sky };
      if (/Cal lies under/i.test(v) || /Cal does not move/i.test(v)) s.cal = { pose: "under-trailer", move: "still" };
      if (triggers.some((t) => t.id === "flash")) {
        s.flash = { at: "trigger:flash" };
        ctx.sky = "drained";
      }
      if (/White drains/i.test(v)) {
        s.flash = { at: 0, drain: 1.5 };
        s.sky = { from: "drained" };
      }
      const glass = /Glass squares fall from the cab window at (\d+(?:\.\d+)?) s/i.exec(v);
      if (glass !== null) s.glass = { at: pin(ctx, Number(glass[1]), sfx) };
      const jolt = /At (\d+(?:\.\d+)?) s the whole frame jolts (\d+) px for (\d+(?:\.\d+)?) s/i.exec(v);
      if (jolt !== null) s.jolt = { at: pin(ctx, Number(jolt[1]), sfx), duration: Number(jolt[3]), px: Number(jolt[2]) };
      const dust = /dust band drifts (right|left) at (\d+) px\/s/i.exec(v);
      if (dust !== null) s.dust = { drift: (dust[1] === "left" ? -1 : 1) * Number(dust[2]) };
      break;
    }
    case "highway-walk": {
      if (isFirstOfShot) s.sky = { from: ctx.sky };
      const cars = /(\w+) stopped cars/i.exec(v);
      const n = cars === null ? null : numberFrom(cars[1] ?? "");
      if (n !== null) s.cars = n;
      const stop = timeAfter(ctx.row.sound, /Footsteps stop at/);
      if (/Cal walks/i.test(v) || stop !== null) s.cal = { move: "walk", ...(stop === null ? {} : { until: rel(ctx, stop) }) };
      const hidden = /Hidden detail: from (\d+(?:\.\d+)?) s/i.exec(v);
      if (hidden !== null) s.hidden = { from: rel(ctx, Number(hidden[1])) };
      const pushed = /push (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?)/i.exec(v);
      if (pushed !== null) s.push = { from: Number(pushed[1]), to: Number(pushed[2]) };
      break;
    }
    case "cab-interior": {
      if (/dusk gradient/i.test(v)) {
        s.sky = { from: ctx.sky, to: "dusk" };
        ctx.sky = "dusk";
        ctx.duskMix = 0;
      } else if (/dusk deepens/i.test(v)) {
        s.sky = { from: "dusk", to: "night", mix: [ctx.duskMix, 0.25] };
        ctx.duskMix = 0.25;
      } else if (/collapses to night/i.test(v)) {
        s.sky = { from: "dusk", to: "night", mix: [ctx.duskMix, 1] };
        ctx.sky = "night";
      } else if (isFirstOfShot) s.sky = { from: ctx.sky };
      if (/sun touches the line/i.test(v)) s.sun = { from: "touching", to: "touching" };
      if (/sun drops below the line/i.test(v)) s.sun = { from: "touching", to: "below" };
      const lights = /dot lights at (\d+(?:\.\d+)?) s/i.exec(v);
      if (lights !== null) s.radio = { on: pin(ctx, Number(lights[1]), sfx) };
      if (/dot pulses with the voice/i.test(v)) s.radio = { on: "start", pulse: 0 };
      if (/loop restarts/i.test(ctx.row.sound) && /cut by a click/i.test(ctx.row.sound)) {
        const k = sfx.filter((x) => x.file === "click").length - 1;
        s.radio = { on: "start", ...(k >= 0 ? { off: `sfx:click#${k}` } : {}) };
      }
      break;
    }
    case "cab-exterior-night": {
      ctx.sky = "night";
      if (/window a slightly lighter rectangle/i.test(v)) s.window = { lit: true };
      const out = /At (\d+(?:\.\d+)?) s the window light goes out/i.exec(v);
      if (out !== null) s.window = { off: pin(ctx, Number(out[1]), sfx) };
      const up = /jerks upright inside the window at (\d+(?:\.\d+)?) s/i.exec(v);
      if (up !== null) s.cal = { up: pin(ctx, Number(up[1]), sfx) };
      if (/door rectangle shakes/i.test(v) && sfx.some((x) => x.file === "bang")) s.door = { shakeOn: "bang" };
      const dawn = /dawn line creeps along the horizon from (\d+(?:\.\d+)?) s/i.exec(v);
      if (dawn !== null) s.dawn = { from: rel(ctx, Number(dawn[1])) };
      if (/five short vertical strokes and a smear/i.test(v)) s.print = { from: 0 };
      const black = /At (\d+(?:\.\d+)?) s cut to black/i.exec(v);
      if (black !== null) {
        const t = Number(black[1]);
        const line = lines[lines.length - 1];
        if (line !== undefined) {
          // Pin the cut to the word that lands nearest it at the voice's natural pace.
          const lead = lines.reduce((acc, l, i) => (i < lines.length - 1 ? acc + l.pauseBefore + estimateSeconds(l.text, l.voice as VoiceId) : acc), 0);
          const lineStart = ctx.start + lead + line.pauseBefore;
          const dur = estimateSeconds(line.text, line.voice as VoiceId);
          const words = wordsOf(line.text);
          const k = Math.max(0, Math.min(words.length - 1, Math.round(((t - lineStart) / dur) * words.length)));
          triggers.push({ id: "black", line: lines.length - 1, word: normaliseWord(words[k] ?? ""), fallback: r1(Math.max(0, Math.min(1, (t - lineStart) / dur))), hold: 0 });
          s.black = { at: "trigger:black" };
          // A sound written at the same moment (the click) rides the cut.
          for (const x of sfx) if (typeof x.at === "number" && Math.abs(ctx.start + x.at - t) < 0.01) x.at = "trigger:black";
        } else s.black = { at: rel(ctx, t) };
      }
      break;
    }
    default:
      break;
  }
  return s;
};

/** Smallest pace, in 0.05 steps up to 1.5, at which the cue's lines (and trigger holds) fit its target duration. */
const fitPace = (lines: LineOut[], triggers: TriggerOut[], duration: number): number => {
  for (let pace = 1; pace <= 1.5 + 1e-9; pace = Math.round((pace + 0.05) * 100) / 100) {
    let cursor = 0;
    const spans: { start: number; end: number }[] = [];
    for (const l of lines) {
      const start = cursor + l.pauseBefore;
      const end = start + estimateSeconds(l.text, l.voice as VoiceId, pace);
      spans.push({ start, end });
      cursor = end;
    }
    const holds = triggers.every((t) => {
      const span = spans[t.line ?? 0];
      return span === undefined || span.start + (t.fallback ?? 0.85) * (span.end - span.start) + (t.hold ?? 0) <= duration + 1e-9;
    });
    if (cursor <= duration + 1e-9 && holds) return pace;
  }
  return 1.5;
};

export const convertMarkdown = (markdown: string, slug: string): { episode: EpisodeInput; report: ConvertReport } => {
  const report: ConvertReport = { guesses: [], unparsed: [] };
  const rows = parseCueTable(markdown);
  const rules = readSync(markdown);
  const epNumber = Number(/(\d+)/.exec(slug)?.[1] ?? "0");
  const dayMatch = /\bDAY\s+(\d+)\b/.exec(markdown);
  const day = dayMatch === null ? epNumber : Number(dayMatch[1]);
  const radioVoice: VoiceId = "authority";

  const cues: CueOut[] = [];
  let open: number | null = null;
  const changes: { cue: string; to: number }[] = [];
  let hiddenCue: string | null = null;
  const ctxBase = { prevScene: null as string | null, sky: "day" as Ctx["sky"], duskMix: 0, lastRadioClip: null as string | null };

  for (const row of rows) {
    const ctx: Ctx = { row, start: row.start, end: r1(row.start + row.dur), report, rules, ...ctxBase };
    const lines = readNarration(ctx, radioVoice);
    const tally = /Tally:\s*(\w+)/i.exec(row.narration);
    if (open === null && tally !== null) open = numberFrom(tally[1] ?? "");
    const change = /\btally\b[^.]*?\b(\d+)\s*(?:to|→)\s*(\d+)/i.exec(row.visual);
    if (change !== null) changes.push({ cue: row.cue, to: Number(change[2]) });
    const { scene, cut } = sceneOf(ctx);
    // The flash trigger has to exist before the sound column can cut the rumble on it.
    const flash = flashTrigger(ctx);
    const triggers: TriggerOut[] = flash === null ? [] : [flash];
    const sfx = readSound(ctx, triggers);
    const state = readState(ctx, scene, sfx, lines, triggers);
    if (/Hidden detail/i.test(row.visual)) hiddenCue = row.cue;
    const radioLine = lines.findIndex((l) => l.voice === radioVoice);
    if (radioLine >= 0) ctxBase.lastRadioClip = `${row.cue}#${radioLine}`;
    ctxBase.prevScene = scene;
    ctxBase.sky = ctx.sky;
    ctxBase.duskMix = ctx.duskMix;
    const part = scene === "day-card" ? "card" : scene === "end-card" ? "end" : row.start < 20 ? "situation" : row.start < 45 ? "escalation" : row.start < 62 ? "climax" : "sting";
    cues.push({
      id: row.cue,
      part,
      scene,
      ...(cut && scene === cues[cues.length - 1]?.scene ? { cut: true } : {}),
      state,
      narration: lines,
      triggers,
      sfx,
      minDuration: row.dur,
      notes: row.visual,
    });
  }

  // Effects that need silence: push a following line back until it clears.
  const silences: { at: number; until: number }[] = [];
  cues.forEach((c, i) => {
    const row = rows[i];
    if (row === undefined) return;
    for (const s of c.sfx ?? []) {
      if (s.clear !== undefined && typeof s.at === "number") silences.push({ at: row.start + s.at, until: row.start + s.at + s.clear });
    }
  });
  cues.forEach((c, i) => {
    const row = rows[i];
    const first = c.narration?.[0];
    if (row === undefined || first === undefined) return;
    const lineStart = row.start + first.pauseBefore;
    const clearAt = Math.max(...silences.filter((x) => x.at <= lineStart && x.until > row.start).map((x) => x.until), -Infinity);
    if (row.start + first.pauseBefore < clearAt + 0.1) {
      first.pauseBefore = Math.ceil((clearAt + 0.1 - row.start) * 10 - 1e-9) / 10;
      report.guesses.push(`${c.id}: first line waits ${first.pauseBefore} s to clear the effect before it`);
    }
  });

  // Pace directions so the voice's natural rate lands the table's timings.
  for (const c of cues) {
    const lines = c.narration ?? [];
    if (lines.length === 0) continue;
    const pace = fitPace(lines, c.triggers ?? [], c.minDuration);
    if (pace > 1) for (const l of lines) l.pace = pace;
    if (pace >= 1.5) report.guesses.push(`${c.id}: narration does not fit ${c.minDuration} s even at pace 1.5; the cue will run long`);
  }

  for (const c of cues) for (const l of c.narration ?? []) if (!isVoiceId(l.voice)) report.unparsed.push(`${c.id}: unknown voice ${l.voice}`);

  const openCount = open ?? 0;
  const close = changes.length > 0 ? (changes[changes.length - 1]?.to ?? openCount) : openCount;
  if (open === null) report.guesses.push('No "Tally: n" in the narration; opening tally set to 0');
  const episode: EpisodeInput = {
    episode: epNumber,
    day,
    tally: { open: openCount, close, struck: [], changes },
    voices: { narrator: "cal", radio: radioVoice },
    ...(hiddenCue === null
      ? {}
      : { hidden: { cue: hiddenCue, words: ["figure", "figures", "someone", "somebody", "person", "people", "stranger", "watching", "watched"] } }),
    post: {},
    cues,
  };
  return { episode, report };
};
