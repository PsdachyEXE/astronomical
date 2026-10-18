import { Composition } from "remotion";
import { Episode, type EpisodeProps } from "./Episode";
import { FPS, FRAME } from "./layout";

const defaultProps: EpisodeProps = { platform: "master", debug: false };

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      durationInFrames={90}
      fps={FPS}
      width={FRAME.width}
      height={FRAME.height}
      defaultProps={defaultProps}
    />
  );
};
