import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { captionCharsPerRow } from "../src/layout";
import { parseEpisode } from "../src/lib/episode";
import { buildTimeline } from "../src/lib/timeline";
import type { Timing } from "../src/lib/timing";
import { clipHash, evenWords } from "../src/lib/timing";
import { UNIVERSAL_STAGE } from "../src/platforms";
import { estimateSeconds, wordsOf, type VoiceId } from "../src/voices";
import { parseCueTable } from "../scripts/lib/cue-table";
import { loadTimeline } from "../scripts/lib/inputs";
import { docFile } from "../scripts/lib/paths";
import { buildSfxIndex } from "../scripts/lib/sfx-index";

const { timeline, problems } = loadTimeline("ep01");
const cue = (id: string) => {
  const c = timeline.cues.find((x) => x.id === id);
  if (c === undefined) throw new Error(`no cue ${id}`);
  return c;
};

describe("episode 1 timeline (placeholder clips)", () => {
  it("has no errors", () => {
    expect(problems.filter((p) => p.level === "error")).toEqual([]);
  });

  it("runs 72 to 75 s", () => {
    expect(timeline.duration).toBeGreaterThanOrEqual(72);
    expect(timeline.duration).toBeLessThanOrEqual(75);
  });

  it("lands every cue start within 0.5 s of the doc's table", () => {
    const rows = parseCueTable(readFileSync(docFile("ep01"), "utf8"));
    expect(rows).toHaveLength(16);
    for (const row of rows) expect(Math.abs(cue(row.cue).start - row.start)).toBeLessThanOrEqual(0.5);
  });

  it("fires the flash at 85% of the C03 clip, since placeholder word stamps are estimates", () => {
    const c03 = cue("C03");
    const line = c03.lines[0];
    const flash = c03.triggers.find((t) => t.id === "flash");
    if (line === undefined || flash === undefined) throw new Error("missing");
    expect(flash.source).toBe("fallback");
    expect(flash.time).toBeCloseTo(line.start + 0.85 * (line.end - line.start), 6);
  });

  it("puts the bangs at 58.0, 59.4 and 61.0 s with no narration within a second", () => {
    const bangs = cue("C12").sfx.filter((s) => s.name === "bang").map((s) => s.start);
    expect(bangs).toHaveLength(3);
    [58.0, 59.4, 61.0].forEach((t, i) => expect(Math.abs((bangs[i] ?? 0) - t)).toBeLessThanOrEqual(0.3));
    const lines = timeline.cues.flatMap((c) => c.lines);
    for (const b of bangs) for (const l of lines) expect(l.end <= b - 1 || l.start >= b + 1).toBe(true);
  });

  it("gives the bangs three different pitches within 2%", () => {
    const pitches = cue("C12").sfx.filter((s) => s.name === "bang").map((s) => s.pitch);
    expect(new Set(pitches).size).toBe(3);
    for (const p of pitches) expect(Math.abs(p - 1)).toBeLessThanOrEqual(0.02);
  });

  it("shows the hidden figure from 28.0 s until the cut at 35.0 s", () => {
    const s = cue("C06").state;
    expect(s.kind === "highway-walk" ? s.hidden?.from : null).toBeCloseTo(28.0, 6);
    expect(cue("C07").end).toBeCloseTo(35.0, 6);
    expect(cue("C08").scene).not.toBe("highway-walk");
  });

  it("keeps captions to two rows that fit the stage, and off the hidden detail", () => {
    const max = captionCharsPerRow(UNIVERSAL_STAGE.w);
    for (const page of timeline.captions) {
      expect(page.rows.length).toBeLessThanOrEqual(2);
      for (const row of page.rows) expect(row.length).toBeLessThanOrEqual(max);
      expect(page.rows.join(" ")).not.toMatch(/\b(figure|someone|somebody|person|stranger)\b/i);
      expect(page.end).toBeGreaterThan(page.start);
    }
  });

  it("splits loop beds on absolute time so they never restart", () => {
    const wind = timeline.audio.filter((a) => a.kind === "bed" && a.name === "wind");
    for (const seg of wind) {
      expect(seg.offset).toBeCloseTo(seg.start % 30, 5);
    }
  });
});

/** A two-cue episode with placeholder-style timing built in memory. */
const tinyEpisode = (minDuration: number) => {
  const episode = parseEpisode(
    {
      episode: 99,
      day: 8,
      tally: { open: 3, close: 4, changes: [{ cue: "F02", to: 4 }] },
      voices: { narrator: "cal", radio: "authority" },
      cues: [
        { id: "F01", scene: "black-slit", narration: [{ voice: "cal", text: "Three.", pauseBefore: 0.4 }], minDuration },
        { id: "F02", scene: "black-slit", narration: [{ voice: "cal", text: "Four.", pauseBefore: 0.4 }], minDuration },
      ],
    },
    "tiny",
  );
  const clips: Timing["clips"] = {};
  for (const c of episode.cues) {
    c.narration.forEach((l, i) => {
      const d = estimateSeconds(l.text, l.voice as VoiceId);
      clips[`${c.id}#${i}`] = {
        file: `voice/tiny/${c.id}-${i}.wav`,
        voice: l.voice,
        text: l.text,
        pace: 1,
        duration: d,
        words: evenWords(wordsOf(l.text), d),
        wordTiming: "estimated",
        hash: clipHash(l.voice, l.text, 1),
      };
    });
  }
  return buildTimeline({ slug: "tiny", episode, timing: { episode: "tiny", provider: "test", clips }, sfx: buildSfxIndex() });
};

describe("tally changes", () => {
  it("insert a 1.2-second card before the named cue, drawing the fourth mark", () => {
    const { timeline: tl } = tinyEpisode(31);
    const card = tl.cues[1];
    expect(card?.synthetic).toBe(true);
    expect(card?.duration).toBeCloseTo(1.2, 6);
    expect(card?.state.kind).toBe("tally-card");
    if (card?.state.kind === "tally-card") {
      expect(card.state.drawMarks).toEqual([3]);
      expect(card.state.marks).toBe(4);
    }
    expect(tl.cues[2]?.start).toBeCloseTo(32.2, 6);
  });

  it("fail the runtime guard when the episode is too short", () => {
    const { problems: p } = tinyEpisode(5);
    expect(p.some((x) => x.code === "duration" && x.level === "error")).toBe(true);
  });
});
