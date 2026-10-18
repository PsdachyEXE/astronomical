/**
 * The timeline builder: episode JSON + measured clips → absolute times for
 * every cue, line, trigger, effect, caption and scene state.
 *
 * Rules (build brief, plus the sync points in docs/ep01.md):
 * - A cue starts where the previous one ends.
 * - Its duration is the largest of minDuration, its pauses + clip lengths +
 *   holdAfter, and each trigger's moment + hold.
 * - A line starts `pauseBefore` after the cue start (first line) or after the
 *   previous clip's end.
 * - A trigger fires at the measured onset of its word; if the clip's word
 *   stamps are estimates, at `fallback` of the clip's length.
 * - Effect times are seconds from the cue start (may be negative) or time
 *   references (see timeref.ts).
 * - A tally change inserts a 1.2-second card before its cue.
 *
 * Pure: no file access, so the composition can call it in the browser.
 */
import { DURATION_GUARD, END_CARD_HOLD, UNIVERSAL_STAGE } from "../platforms";
import { describeScene, resolveScene, type SceneName, type SceneState } from "../scenes/models";
import type { SfxIndex } from "../sfx";
import { isVoiceId, normaliseWord, VOICES, wordsOf } from "../voices";
import { AUTHORITY_MESSAGE } from "../world";
import { captionLine, charsPerRow, type CaptionPage, type TimedWord } from "./captions";
import type { Episode, Part } from "./episode";
import { hashSeed, rng } from "./rng";
import { resolveTimeRef, type RefContext } from "./timeref";
import { clipHash, clipKey, type Timing } from "./timing";

export const TALLY_CARD_SECONDS = 1.2;
const FPS_DEFAULT = 30;

export type TimelineLine = {
  index: number;
  voice: string;
  text: string;
  radio: boolean;
  start: number;
  end: number;
  file: string;
  words: TimedWord[];
  wordTiming: "measured" | "estimated";
};

export type TimelineTrigger = {
  id: string;
  word: string;
  time: number;
  source: "word" | "fallback";
  hold: number;
};

export type AudioEvent = {
  id: string;
  kind: "voice" | "sfx" | "bed" | "clip";
  cue: string;
  /** Effect id or clip key. */
  name: string;
  /** Path under assets/. */
  src: string;
  start: number;
  end: number;
  /** Seconds into the file at `start`. */
  offset: number;
  /** Envelope of the whole instance (a bed split into loop segments shares one). */
  envStart: number;
  envEnd: number;
  gainFrom: number;
  gainTo: number;
  fadeIn: number;
  fadeOut: number;
  /** Playback pitch factor (1 = as recorded). */
  pitch: number;
  /** Seconds of required silence from narration either side, or null. */
  clear: number | null;
};

export type TimelineCue = {
  id: string;
  part: Part | null;
  scene: SceneName;
  synthetic: boolean;
  start: number;
  end: number;
  duration: number;
  startFrame: number;
  endFrame: number;
  minDuration: number;
  shot: number;
  shotStart: number;
  state: SceneState;
  lines: TimelineLine[];
  triggers: TimelineTrigger[];
  sfx: AudioEvent[];
  notes: string | null;
};

export type Timeline = {
  slug: string;
  episode: number;
  day: number;
  fps: number;
  duration: number;
  frames: number;
  tally: { open: number; close: number };
  cues: TimelineCue[];
  audio: AudioEvent[];
  captions: CaptionPage[];
  hidden: { cue: string; words: string[] } | null;
  words: { narrator: number; radio: number };
};

export type Problem = { level: "error" | "warning"; code: string; message: string };

export type BuildInput = {
  slug: string;
  episode: Episode;
  timing: Timing;
  sfx: SfxIndex;
  fps?: number;
};

type TallyMarks = { marks: number; struck: number[] };
const countOf = (t: TallyMarks): number => t.marks - t.struck.length;

const applyChange = (before: TallyMarks, to: number): { after: TallyMarks; draw: number[]; strike: number[] } => {
  const n = countOf(before);
  if (to >= n) {
    const draw = Array.from({ length: to - n }, (_, k) => before.marks + k);
    return { after: { marks: before.marks + draw.length, struck: before.struck }, draw, strike: [] };
  }
  const unstruck = Array.from({ length: before.marks }, (_, i) => i).filter((i) => !before.struck.includes(i));
  const strike = unstruck.slice(unstruck.length - (n - to)).reverse();
  return { after: { marks: before.marks, struck: [...before.struck, ...strike].sort((a, b) => a - b) }, draw: [], strike };
};

const round6 = (x: number): number => Math.round(x * 1e6) / 1e6;

export const buildTimeline = (input: BuildInput): { timeline: Timeline; problems: Problem[] } => {
  const { slug, episode, timing, sfx } = input;
  const fps = input.fps ?? FPS_DEFAULT;
  const problems: Problem[] = [];
  const toFrame = (t: number) => Math.round(t * fps);

  // Tally marks through the episode.
  const open: TallyMarks = { marks: episode.tally.open + episode.tally.struck.length, struck: [...episode.tally.struck] };
  let running = open;
  const changes = new Map<string, { before: TallyMarks; after: TallyMarks; draw: number[]; strike: number[] }>();
  for (const cue of episode.cues) {
    const change = episode.tally.changes.find((c) => c.cue === cue.id);
    if (change !== undefined) {
      const r = applyChange(running, change.to);
      changes.set(cue.id, { before: running, ...r });
      running = r.after;
    }
  }
  for (const c of episode.tally.changes) {
    if (!episode.cues.some((cue) => cue.id === c.cue)) {
      throw new Error(`tally change names cue ${c.cue}, which does not exist`);
    }
  }
  const close = running;
  if (countOf(close) !== episode.tally.close) {
    problems.push({
      level: "error",
      code: "tally",
      message: `tally opens at ${episode.tally.open} and its changes end at ${countOf(close)}, but close says ${episode.tally.close}`,
    });
  }

  const cues: TimelineCue[] = [];
  let t = 0;
  let shot = 0;
  let shotStart = 0;
  let prevScene: string | null = null;
  let prevState: SceneState | null = null;
  const episodeInfo = {
    day: episode.day,
    marksOpen: open.marks,
    struckOpen: open.struck,
    marksClose: close.marks,
    struckClose: close.struck,
  };

  for (const cue of episode.cues) {
    const change = changes.get(cue.id);
    if (change !== undefined) {
      const start = t;
      const end = t + TALLY_CARD_SECONDS;
      cues.push({
        id: `TALLY-${cue.id}`,
        part: null,
        scene: "tally-card",
        synthetic: true,
        start,
        end,
        duration: TALLY_CARD_SECONDS,
        startFrame: toFrame(start),
        endFrame: toFrame(end),
        minDuration: TALLY_CARD_SECONDS,
        shot: -1,
        shotStart: start,
        state: {
          kind: "tally-card",
          marksBefore: change.before.marks,
          struckBefore: change.before.struck,
          marks: change.after.marks,
          struck: change.after.struck,
          drawMarks: change.draw,
          strikeMarks: change.strike,
          start,
        },
        lines: [],
        triggers: [],
        sfx: [],
        notes: `Inserted: tally ${countOf(change.before)} → ${countOf(change.after)}`,
      });
      t = end;
    }

    const start = t;

    // Lines, from measured clip lengths.
    const lines: TimelineLine[] = [];
    let cursor = start;
    for (const [i, line] of cue.narration.entries()) {
      const key = clipKey(cue.id, i);
      const clip = timing.clips[key];
      if (clip === undefined) throw new Error(`${key}: no clip in timing.json. Run npm run tts -- ${slug}`);
      if (clip.hash !== clipHash(line.voice, line.text, line.pace ?? 1)) {
        throw new Error(`${key}: clip is stale (text, voice or pace changed). Run npm run tts -- ${slug}`);
      }
      if (!isVoiceId(line.voice)) throw new Error(`${key}: unknown voice "${line.voice}"`);
      const lineStart = cursor + line.pauseBefore;
      const lineEnd = lineStart + clip.duration;
      lines.push({
        index: i,
        voice: line.voice,
        text: line.text,
        radio: VOICES[line.voice].radio,
        start: round6(lineStart),
        end: round6(lineEnd),
        file: clip.file,
        words: clip.words.map((w) => ({ text: w.text, start: round6(lineStart + w.start), end: round6(lineStart + w.end) })),
        wordTiming: clip.wordTiming,
      });
      cursor = lineEnd;
    }

    // Triggers, from measured word onsets or the fallback fraction.
    const triggers: TimelineTrigger[] = cue.triggers.map((trig) => {
      const line = lines[trig.line];
      if (line === undefined) throw new Error(`${cue.id}: trigger "${trig.id}" names line ${trig.line}, which does not exist`);
      const target = normaliseWord(trig.word);
      const matches = line.words.filter((w) => normaliseWord(w.text) === target);
      const word = matches[trig.occurrence - 1];
      if (word === undefined) {
        throw new Error(`${cue.id}: trigger "${trig.id}" looks for "${trig.word}" (occurrence ${trig.occurrence}) in "${line.text}" and it is not there`);
      }
      const measured = line.wordTiming === "measured";
      const time = measured ? word.start : line.start + trig.fallback * (line.end - line.start);
      return { id: trig.id, word: trig.word, time: round6(time), source: measured ? "word" : "fallback", hold: trig.hold };
    });

    let end = Math.max(start + cue.minDuration, cursor + cue.holdAfter, ...triggers.map((tr) => tr.time + tr.hold));
    if (cue.part === "end") end = Math.max(end, start + END_CARD_HOLD);
    end = round6(end);

    const newShot = cues.filter((c) => !c.synthetic).length === 0 || cue.scene !== prevScene || cue.cut;
    if (newShot) {
      shot++;
      shotStart = start;
      prevState = null;
    }

    // Effects.
    const sfxTimes = new Map<string, number[]>();
    const ctx: RefContext = {
      cueId: cue.id,
      start,
      end,
      lines,
      triggers: new Map(triggers.map((tr) => [tr.id, tr.time])),
      sfx: sfxTimes,
    };
    const instances: AudioEvent[] = [];
    for (const entry of cue.sfx) {
      const name = entry.file ?? entry.clip ?? "";
      let src: string;
      let length: number;
      let loop: boolean;
      let kind: AudioEvent["kind"];
      if (entry.file !== undefined) {
        const info = sfx[entry.file];
        if (info === undefined) throw new Error(`${cue.id}: unknown effect "${entry.file}". Effects: ${Object.keys(sfx).join(", ")}`);
        src = info.file;
        length = info.duration;
        loop = info.loop;
        kind = loop ? "bed" : "sfx";
      } else {
        const clip = timing.clips[name];
        if (clip === undefined) throw new Error(`${cue.id}: sfx clip "${name}" is not in timing.json`);
        src = clip.file;
        length = clip.duration;
        loop = false;
        kind = "clip";
      }
      const at = resolveTimeRef(entry.at, ctx);
      const until = entry.until === undefined ? null : resolveTimeRef(entry.until, ctx);
      const times: number[] = [];
      if (entry.every !== undefined) {
        const stop = until ?? end;
        for (let k = Math.ceil((at - shotStart) / entry.every - 1e-9); shotStart + k * entry.every < stop - 1e-9; k++) {
          times.push(shotStart + k * entry.every);
        }
      } else {
        times.push(at);
      }
      for (const time of times) {
        const index = (sfxTimes.get(name) ?? []).length;
        const naturalEnd = time + length;
        const stopAt = entry.every !== undefined ? naturalEnd : until ?? (loop ? end : naturalEnd);
        const finish = loop ? stopAt : Math.min(stopAt, naturalEnd);
        if (finish <= time) {
          problems.push({ level: "warning", code: "sfx-empty", message: `${cue.id}: ${name}#${index} has no length; skipped` });
          continue;
        }
        const pitch =
          entry.pitch === undefined
            ? 1
            : 1 + entry.pitch * (2 * rng(hashSeed(`${slug}:${cue.id}:${name}:${index}`))() - 1);
        instances.push({
          id: `${cue.id}:${name}#${index}`,
          kind,
          cue: cue.id,
          name,
          src,
          start: round6(time),
          end: round6(finish),
          offset: 0,
          envStart: round6(time),
          envEnd: round6(finish),
          gainFrom: entry.gainFrom ?? entry.gain,
          gainTo: entry.gain,
          fadeIn: entry.fadeIn ?? 0,
          fadeOut: entry.fadeOut ?? 0,
          pitch,
          clear: entry.clear ?? null,
        });
        sfxTimes.set(name, [...(sfxTimes.get(name) ?? []), round6(time)]);
      }
    }

    const state = resolveScene(
      cue.scene,
      cue.state,
      {
        cueId: cue.id,
        start,
        end,
        shotStart,
        time: (ref) => round6(resolveTimeRef(ref, ctx)),
        sfxTimes: (file) => sfxTimes.get(file) ?? [],
        lineWords: (i) => lines[i]?.words.map((w) => ({ start: w.start, end: w.end })) ?? [],
        episode: episodeInfo,
      },
      prevState,
    );

    cues.push({
      id: cue.id,
      part: cue.part ?? null,
      scene: state.kind,
      synthetic: false,
      start,
      end,
      duration: round6(end - start),
      startFrame: toFrame(start),
      endFrame: toFrame(end),
      minDuration: cue.minDuration,
      shot,
      shotStart,
      state,
      lines,
      triggers,
      sfx: instances,
      notes: cue.notes ?? null,
    });
    prevScene = cue.scene;
    prevState = state;
    t = end;
  }

  const duration = round6(t);

  // Audio: every line, every effect; loops split on absolute time so a bed never restarts.
  const audio: AudioEvent[] = [];
  for (const cue of cues) {
    for (const line of cue.lines) {
      audio.push({
        id: `${cue.id}:line${line.index}`,
        kind: "voice",
        cue: cue.id,
        name: clipKey(cue.id, line.index),
        src: line.file,
        start: line.start,
        end: line.end,
        offset: 0,
        envStart: line.start,
        envEnd: line.end,
        gainFrom: 0,
        gainTo: 0,
        fadeIn: 0,
        fadeOut: 0,
        pitch: 1,
        clear: null,
      });
    }
    for (const ev of cue.sfx) {
      if (ev.kind !== "bed") {
        audio.push(ev);
        continue;
      }
      const length = sfx[ev.name]?.duration ?? 0;
      let segStart = ev.start;
      let seg = 0;
      while (segStart < ev.end - 1e-6 && length > 0) {
        let offset = ((segStart % length) + length) % length;
        if (length - offset < 1e-6) offset = 0;
        const segEnd = Math.min(ev.end, segStart + (length - offset));
        audio.push({ ...ev, id: `${ev.id}/${seg}`, start: round6(segStart), end: round6(segEnd), offset: round6(offset) });
        segStart = segEnd;
        seg++;
      }
    }
  }

  // Captions.
  const maxChars = charsPerRow(UNIVERSAL_STAGE.w);
  const allLines = cues.flatMap((c) => c.lines.map((l) => ({ cue: c.id, line: l })));
  // Captions never spill onto the end card: it shows the tally and nothing else.
  const endCardStart = cues.find((c) => c.part === "end")?.start ?? Number.POSITIVE_INFINITY;
  const captions: CaptionPage[] = allLines
    .flatMap(({ cue, line }, k) =>
      captionLine({
        cue,
        line: line.index,
        words: line.words,
        lineEnd: line.end,
        nextLineStart: allLines[k + 1]?.line.start ?? null,
        radio: line.radio,
        maxChars,
      }),
    )
    .map((p) => (p.start < endCardStart ? { ...p, end: Math.min(p.end, endCardStart) } : p));

  const narratorWords = allLines
    .filter(({ line }) => !line.radio)
    .reduce((n, { line }) => n + wordsOf(line.text).length, 0);
  const radioWords = allLines.filter(({ line }) => line.radio).reduce((n, { line }) => n + wordsOf(line.text).length, 0);

  const timeline: Timeline = {
    slug,
    episode: episode.episode,
    day: episode.day,
    fps,
    duration,
    frames: toFrame(duration),
    tally: { open: episode.tally.open, close: episode.tally.close },
    cues,
    audio,
    captions,
    hidden: episode.hidden ?? null,
    words: { narrator: narratorWords, radio: radioWords },
  };

  problems.push(...lint(timeline));
  return { timeline, problems };
};

const fmt = (x: number): string => x.toFixed(2);

/** The episode-shape and sync rules, checked against the built timeline. */
export const lint = (tl: Timeline): Problem[] => {
  const out: Problem[] = [];
  const err = (code: string, message: string) => out.push({ level: "error", code, message });
  const warn = (code: string, message: string) => out.push({ level: "warning", code, message });

  if (tl.duration < DURATION_GUARD.min || tl.duration > DURATION_GUARD.max) {
    err("duration", `runtime ${fmt(tl.duration)} s is outside ${DURATION_GUARD.min} to ${DURATION_GUARD.max} s`);
  }
  if (tl.words.narrator >= 100) err("words", `narration has ${tl.words.narrator} words; it must stay under 100`);
  if (tl.words.radio > 30) err("words", `radio has ${tl.words.radio} words; it adds at most 30`);

  const lines = tl.cues.flatMap((c) => c.lines);
  for (const line of lines) {
    if (line.voice === "authority" && line.text !== AUTHORITY_MESSAGE) {
      err("message", `the Authority message must be verbatim; got "${line.text}"`);
    }
    if (line.radio && line.text !== AUTHORITY_MESSAGE) {
      const sentences = line.text.split(/[.!?]+/).filter((s) => s.trim() !== "").length;
      if (sentences > 2) err("radio", `radio line "${line.text}" has ${sentences} sentences; the limit is two`);
    }
  }

  // Effects that need silence around them.
  for (const ev of tl.cues.flatMap((c) => c.sfx)) {
    if (ev.clear === null) continue;
    const c = ev.clear;
    for (const line of lines) {
      if (line.end > ev.start - c && line.start < ev.start + c) {
        err("clear", `${ev.id} at ${fmt(ev.start)} s has narration within ${c} s ("${line.text}", ${fmt(line.start)}–${fmt(line.end)} s)`);
      }
    }
  }

  // The climax keeps at least two seconds with no voice.
  const climax = tl.cues.filter((c) => c.part === "climax");
  if (climax.length > 0) {
    const from = Math.min(...climax.map((c) => c.start));
    const to = Math.max(...climax.map((c) => c.end));
    const voice = tl.audio
      .filter((a) => (a.kind === "voice" || a.kind === "clip") && a.end > from && a.start < to)
      .map((a) => [Math.max(from, a.start), Math.min(to, a.end)] as const)
      .sort((a, b) => a[0] - b[0]);
    let longest = 0;
    let cursor = from;
    for (const [s, e] of voice) {
      longest = Math.max(longest, s - cursor);
      cursor = Math.max(cursor, e);
    }
    longest = Math.max(longest, to - cursor);
    if (longest < 2) err("climax", `the climax (${fmt(from)}–${fmt(to)} s) has no two-second stretch without a voice`);
  }

  const last = [...lines].reverse().find((l) => !l.radio);
  if (last !== undefined && /\?\s*["”’]?\s*$/.test(last.text)) err("sting", `the sting is a question: "${last.text}"`);

  if (tl.hidden !== null) {
    if (!tl.cues.some((c) => c.id === tl.hidden?.cue)) err("hidden", `hidden detail names cue ${tl.hidden.cue}, which does not exist`);
    const pattern = new RegExp(`\\b(${tl.hidden.words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "i");
    for (const page of tl.captions) {
      const text = page.rows.join(" ");
      if (pattern.test(text)) err("hidden", `caption "${text}" mentions the hidden detail`);
    }
  }

  for (const c of tl.cues) {
    const over = c.duration - c.minDuration;
    if (!c.synthetic && c.part !== "end" && over > 0.01) {
      warn("overrun", `${c.id} runs ${fmt(over)} s past its ${fmt(c.minDuration)} s target`);
    }
  }
  return out;
};

/** One line per cue for logs. */
export const describeCue = (c: TimelineCue): string => describeScene(c.state, { start: c.start, end: c.end });
