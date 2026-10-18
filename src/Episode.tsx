import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AudioLayer } from "./AudioLayer";
import { Captions } from "./Captions";
import { ReadableProbe } from "./debug/ReadableProbe";
import { SafeZoneOverlay } from "./debug/SafeZoneOverlay";
import { ensureFonts } from "./fonts";
import { timelineFromProps, type EpisodeProps } from "./lib/props";
import type { TimelineCue } from "./lib/timeline";
import { PALETTE } from "./palette";
import { platformConfig, stageFor } from "./platforms";
import { SceneView } from "./scenes/SceneView";

ensureFonts();

export const cueAtFrame = (cues: readonly TimelineCue[], frame: number): TimelineCue | null =>
  cues.find((c) => frame >= c.startFrame && frame < c.endFrame) ?? cues[cues.length - 1] ?? null;

/**
 * One episode on one target. The target changes only the stage readable
 * elements are laid out on, whether captions burn in, and (outside this
 * component) the encode preset.
 */
export const Episode: React.FC<EpisodeProps> = (props) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { episode, timing, sfx, slug } = props;
  const { timeline } = useMemo(
    () => timelineFromProps({ episode, timing, sfx, slug, platform: "master", debug: false }),
    [episode, timing, sfx, slug],
  );
  const stage = stageFor(props.platform);
  const cue = cueAtFrame(timeline.cues, frame);
  const t = frame / fps;
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.black }} data-tally-frame="">
      {cue === null ? null : (
        <SceneView
          state={cue.state}
          t={t}
          frame={frame}
          fps={fps}
          stage={stage}
          seed={`${timeline.slug}:${cue.synthetic ? cue.id : `shot${cue.shot}`}`}
        />
      )}
      {platformConfig(props.platform).captions ? <Captions pages={timeline.captions} t={t} stage={stage} /> : null}
      <AudioLayer timeline={timeline} />
      {props.debug ? <SafeZoneOverlay platform={props.platform} label={props.debugLabel} /> : null}
      {props.debug ? <ReadableProbe platform={props.platform} /> : null}
    </AbsoluteFill>
  );
};
