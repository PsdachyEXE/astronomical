import { Composition } from "remotion";
import { Gallery } from "./dev/Gallery";
import { Episode, type EpisodeProps } from "./Episode";
import { FPS, FRAME } from "./layout";

const defaultProps: EpisodeProps = { platform: "master", debug: false };

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Episode"
        component={Episode}
        durationInFrames={90}
        fps={FPS}
        width={FRAME.width}
        height={FRAME.height}
        defaultProps={defaultProps}
      />
      <Composition id="Gallery" component={Gallery} durationInFrames={1} fps={FPS} width={FRAME.width} height={FRAME.height} />
    </>
  );
};
