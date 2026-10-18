import { Html5Audio, Sequence, staticFile } from "remotion";
import { volumeAt } from "./audio";
import type { Timeline } from "./lib/timeline";

/**
 * Every narration clip, effect and bed segment, placed from the timeline.
 * Beds arrive already split on absolute loop boundaries, so each segment is a
 * plain trimmed clip and a bed that spans cues never restarts.
 */
export const AudioLayer: React.FC<{ timeline: Timeline }> = ({ timeline }) => {
  const fps = timeline.fps;
  return (
    <>
      {timeline.audio.map((ev) => {
        const from = Math.round(ev.start * fps);
        const to = Math.round(ev.end * fps);
        if (to <= from) return null;
        return (
          <Sequence key={ev.id} from={from} durationInFrames={to - from} layout="none" name={ev.id}>
            <Html5Audio
              src={staticFile(ev.src)}
              trimBefore={Math.round(ev.offset * fps)}
              volume={(f) => volumeAt(ev, (from + f) / fps)}
              toneFrequency={ev.pitch === 1 ? undefined : ev.pitch}
            />
          </Sequence>
        );
      })}
    </>
  );
};
