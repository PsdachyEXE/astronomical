/** The composition's props, and turning them into a timeline (shared by the composition and calculateMetadata). */
import type { TargetId } from "../platforms";
import type { SfxIndex } from "../sfx";
import { parseEpisode } from "./episode";
import { buildTimeline, type Problem, type Timeline } from "./timeline";
import { TimingSchema } from "./timing";

export type EpisodeProps = {
  /** The episode JSON, as written in episodes/. */
  episode: unknown;
  /** assets/voice/<episode>/timing.json. */
  timing: unknown;
  /** Effect lengths measured from assets/sfx. */
  sfx: SfxIndex;
  slug: string;
  platform: TargetId;
  /** Draws the platform's blocked zones and the measured boxes of readable elements. */
  debug: boolean;
};

export const timelineFromProps = (props: EpisodeProps): { timeline: Timeline; problems: Problem[] } =>
  buildTimeline({
    slug: props.slug,
    episode: parseEpisode(props.episode, `episodes/${props.slug}.json`),
    timing: TimingSchema.parse(props.timing),
    sfx: props.sfx,
  });
