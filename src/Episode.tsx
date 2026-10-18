import { AbsoluteFill } from "remotion";
import { SafeZoneOverlay } from "./debug/SafeZoneOverlay";
import { PALETTE } from "./palette";
import type { TargetId } from "./platforms";

export type EpisodeProps = {
  platform: TargetId;
  debug: boolean;
};

export const Episode: React.FC<EpisodeProps> = ({ platform, debug }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.black }}>
      {debug ? <SafeZoneOverlay platform={platform} /> : null}
    </AbsoluteFill>
  );
};
