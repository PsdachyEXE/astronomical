import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEpisode } from "../src/lib/episode";
import { convertMarkdown } from "../scripts/lib/convert";
import { docFile, episodeFile, readJson } from "../scripts/lib/paths";

describe("new-episode converter on docs/ep01.md", () => {
  const { episode: draft, report } = convertMarkdown(readFileSync(docFile("ep01"), "utf8"), "ep01");
  const converted = parseEpisode(draft, "converted");
  const hand = parseEpisode(readJson(episodeFile("ep01")), "hand");

  it("produces a valid episode with nothing left unplaced", () => {
    expect(report.unparsed).toEqual([]);
    expect(converted.day).toBe(1);
    expect(converted.tally.open).toBe(1);
    expect(converted.hidden?.cue).toBe("C06");
  });

  it("matches the hand conversion's cues, scenes and narration exactly", () => {
    expect(converted.cues.map((c) => c.id)).toEqual(hand.cues.map((c) => c.id));
    expect(converted.cues.map((c) => c.scene)).toEqual(hand.cues.map((c) => c.scene));
    expect(converted.cues.map((c) => c.minDuration)).toEqual(hand.cues.map((c) => c.minDuration));
    const lines = (e: typeof hand) =>
      e.cues.flatMap((c) => c.narration.map((l) => [c.id, l.voice, l.text, l.pauseBefore, l.pace ?? 1]));
    expect(lines(converted)).toEqual(lines(hand));
  });

  it("places the same effects in every cue", () => {
    const fx = (e: typeof hand) => e.cues.map((c) => c.sfx.map((s) => s.file ?? s.clip).sort());
    expect(fx(converted)).toEqual(fx(hand));
  });

  it("finds the flash on 'white' at 85% and the cut to black on 'why'", () => {
    const c03 = converted.cues.find((c) => c.id === "C03");
    expect(c03?.triggers).toEqual([{ id: "flash", line: 0, word: "white", occurrence: 1, fallback: 0.85, hold: 0.9 }]);
    const c15 = converted.cues.find((c) => c.id === "C15");
    expect(c15?.triggers[0]?.word).toBe("why");
  });
});
