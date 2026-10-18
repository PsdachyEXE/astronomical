import { AbsoluteFill } from "remotion";
import { FRAME } from "../layout";
import { blockedZonesFor, platformConfig, stageFor, type TargetId } from "../platforms";
import { PALETTE } from "../palette";

/**
 * Debug only: the target's interface bands as translucent rectangles and its
 * stage as an outline. Never rendered in a deliverable.
 */
export const SafeZoneOverlay: React.FC<{ platform: TargetId }> = ({ platform }) => {
  const zones = blockedZonesFor(platform);
  const stage = stageFor(platform);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        {zones.map((z, i) => (
          <rect key={i} x={z.x} y={z.y} width={z.w} height={z.h} fill={PALETTE.flash} fillOpacity={0.28} />
        ))}
        <rect
          x={stage.x}
          y={stage.y}
          width={stage.w}
          height={stage.h}
          fill="none"
          stroke={PALETTE.flash}
          strokeOpacity={0.7}
          strokeWidth={3}
          strokeDasharray="18 12"
        />
        <text
          x={stage.x + 12}
          y={stage.y + 40}
          fill={PALETTE.flash}
          fillOpacity={0.9}
          fontFamily="TallyMono, monospace"
          fontSize={32}
        >
          {platformConfig(platform).label}
        </text>
      </svg>
    </AbsoluteFill>
  );
};
