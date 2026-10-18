import { Composition, type CalculateMetadataFunction } from "remotion";
import ep01 from "../episodes/ep01.json";
import ep01Timing from "../assets/voice/ep01/timing.json";
import sfxIndex from "../assets/sfx/index.json";
import { Gallery } from "./dev/Gallery";
import { Episode } from "./Episode";
import { FPS, FRAME } from "./layout";
import { timelineFromProps, type EpisodeProps } from "./lib/props";

const defaultProps: EpisodeProps = {
  episode: ep01,
  timing: ep01Timing,
  sfx: sfxIndex,
  slug: "ep01",
  platform: "master",
  debug: false,
};

const calculateMetadata: CalculateMetadataFunction<EpisodeProps> = ({ props }) => ({
  durationInFrames: timelineFromProps(props).timeline.frames,
});

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Episode"
        component={Episode}
        durationInFrames={1}
        fps={FPS}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={defaultProps}
        calculateMetadata={calculateMetadata}
      />
      <Composition id="Gallery" component={Gallery} durationInFrames={1} fps={FPS} width={FRAME.width} height={FRAME.height} />
    </>
  );
};
