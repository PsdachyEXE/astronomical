import { describe, expect, it } from "vitest";
import { parseEpisode } from "../src/lib/episode";
import { buildPostMeta, checkPostMeta, tallyLine } from "../src/post";
import { episodeFile, readJson } from "../scripts/lib/paths";

describe("post metadata", () => {
  const episode = parseEpisode(readJson(episodeFile("ep01")), "ep01");
  const metas = buildPostMeta(episode, "ep01");

  it("covers all five platforms and passes its own checks", () => {
    expect(metas.map((m) => m.platform).sort()).toEqual(["facebook", "instagram", "snapchat", "tiktok", "youtube"]);
    expect(checkPostMeta(metas, episode.hidden?.words ?? [])).toEqual([]);
  });

  it("says the day and tally, and that the message is fiction", () => {
    for (const m of metas) {
      expect(m.caption).toContain("Day 1.");
      expect(m.caption).toContain("Tally: 1");
      expect(m.caption).toMatch(/Fiction\./);
    }
  });

  it("writes a tally change as an arrow", () => {
    expect(tallyLine(3, 4)).toBe("Tally: 3 → 4");
  });

  it("catches a mention of the hidden detail", () => {
    const leaked = metas.map((m) => ({ ...m, caption: `${m.caption} Someone was watching.` }));
    expect(checkPostMeta(leaked, ["someone", "watching"]).length).toBe(5);
  });
});
