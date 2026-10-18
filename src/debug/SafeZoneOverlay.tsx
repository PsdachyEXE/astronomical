import { AbsoluteFill } from "remotion";
import { FONT_FAMILY } from "../fonts";
import { FRAME } from "../layout";
import { DEBUG } from "../palette";
import { platformConfig, stageFor, type TargetId } from "../platforms";

/**
 * Debug only: the target's interface as one translucent band around the
 * frame (the master shows the union of all five), its stage as a dashed
 * outline, and a label. Never rendered in a deliverable.
 */
export const SafeZoneOverlay: React.FC<{ platform: TargetId; label?: string }> = ({ platform, label }) => {
  const cfg = platformConfig(platform);
  const m = cfg.safeZone;
  const stage = stageFor(platform);
  const inner = `M ${m.left} ${m.top} H ${FRAME.width - m.right} V ${FRAME.height - m.bottom} H ${m.left} Z`;
  const outer = `M 0 0 H ${FRAME.width} V ${FRAME.height} H 0 Z`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        <path d={`${outer} ${inner}`} fill={DEBUG.zone} fillOpacity={0.32} fillRule="evenodd" />
        <rect
          x={stage.x}
          y={stage.y}
          width={stage.w}
          height={stage.h}
          fill="none"
          stroke={DEBUG.stage}
          strokeOpacity={0.75}
          strokeWidth={3}
          strokeDasharray="18 12"
        />
        <text x={24} y={70} fill={DEBUG.label} fontFamily={FONT_FAMILY} fontWeight={600} fontSize={54}>
          {cfg.label}
        </text>
        {label === undefined ? null : (
          <text x={24} y={FRAME.height - 36} fill={DEBUG.label} fontFamily={FONT_FAMILY} fontWeight={600} fontSize={54}>
            {label}
          </text>
        )}
      </svg>
    </AbsoluteFill>
  );
};
