import { Composition } from "remotion";
import { Episode } from "./Episode";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Episode"
      component={Episode}
      durationInFrames={90}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
