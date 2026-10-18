/**
 * Post metadata per platform: a title, a description and a few hashtags,
 * built from the episode's day and tally. Plain on purpose: three hashtags at
 * most, and every description says the emergency message is fiction.
 */
import type { Episode } from "./lib/episode";
import { PLATFORM_IDS, platformConfig, type PlatformId } from "./platforms";
import { SERIES } from "./world";

export type PostMeta = {
  platform: PlatformId;
  label: string;
  file: string;
  title: string;
  description: string;
  hashtags: string[];
  /** Ready to paste where the platform has one text box (title, description and tags together). */
  caption: string;
};

/** Text limits we hold ourselves to: conservative readings of each upload form, re-check in the app. */
const LIMITS: Record<PlatformId, { title: number; caption: number }> = {
  youtube: { title: 100, caption: 5000 },
  instagram: { title: 125, caption: 2200 },
  snapchat: { title: 80, caption: 250 },
  tiktok: { title: 90, caption: 2200 },
  facebook: { title: 255, caption: 2200 },
};

const TAGS: Record<PlatformId, string[]> = {
  youtube: ["#TALLY", "#Shorts", "#animation"],
  instagram: ["#TALLY", "#animation", "#serial"],
  snapchat: ["#TALLY", "#animation"],
  tiktok: ["#TALLY", "#animation", "#serial"],
  facebook: ["#TALLY", "#animation"],
};

export const tallyLine = (open: number, close: number): string =>
  open === close ? `Tally: ${close}` : `Tally: ${open} → ${close}`;

export const buildPostMeta = (episode: Episode, slug: string): PostMeta[] => {
  const tally = tallyLine(episode.tally.open, episode.tally.close);
  const title = `${SERIES.title} · Day ${episode.day} · ${tally}`;
  return PLATFORM_IDS.map((platform) => {
    const short = platform === "snapchat";
    const lines = short
      ? [`Day ${episode.day}. ${tally}.`, episode.post.hook ?? null, "Fiction. Not a real emergency broadcast."]
      : [
          `Day ${episode.day}. ${tally}.`,
          episode.post.hook ?? null,
          SERIES.logline,
          `Episode ${episode.episode} of ${SERIES.title}, a serial told one day at a time.`,
          SERIES.fiction,
        ];
    const description = lines.filter((l): l is string => l !== null).join("\n");
    const hashtags = TAGS[platform];
    const caption = short
      ? `${description} ${hashtags.join(" ")}`
      : `${title}\n\n${description}\n\n${hashtags.join(" ")}`;
    return {
      platform,
      label: platformConfig(platform).label,
      file: `out/${slug}.${platform}.mp4`,
      title,
      description,
      hashtags,
      caption,
    };
  });
};

/** Problems with built metadata: over-long text, too many tags, or a mention of the hidden detail. */
export const checkPostMeta = (metas: readonly PostMeta[], hiddenWords: readonly string[]): string[] => {
  const problems: string[] = [];
  const hidden = hiddenWords.length === 0 ? null : new RegExp(`\\b(${hiddenWords.join("|")})\\b`, "i");
  for (const m of metas) {
    const limit = LIMITS[m.platform];
    if (m.title.length > limit.title) problems.push(`${m.label}: title is ${m.title.length} characters (limit ${limit.title})`);
    if (m.caption.length > limit.caption) problems.push(`${m.label}: caption is ${m.caption.length} characters (limit ${limit.caption})`);
    if (m.hashtags.length > 3) problems.push(`${m.label}: ${m.hashtags.length} hashtags; keep it to three`);
    if (hidden !== null && hidden.test(`${m.title} ${m.caption}`)) problems.push(`${m.label}: text mentions the hidden detail`);
  }
  return problems;
};
