import { useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame } from "remotion";
import { FRAME, intersects, type Box } from "../layout";
import { DEBUG } from "../palette";
import { blockedZonesFor, type TargetId } from "../platforms";
import { PROBE_PREFIX, type ProbeReport } from "./ProbeReport";


const GEOMETRY = "text, line, rect, circle, path, polygon, ellipse";

/** Union of an element's painted geometry, strokes included, in frame pixels. */
const measure = (el: Element, root: DOMRect, scale: number): Box | null => {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  const parts = [el, ...Array.from(el.querySelectorAll(GEOMETRY))];
  for (const part of parts) {
    if (!(part instanceof SVGGraphicsElement) || part.tagName === "g") continue;
    const r = part.getBoundingClientRect();
    const style = getComputedStyle(part);
    const stroked = style.stroke !== "none" && style.stroke !== "";
    const ctm = part.getScreenCTM();
    const ctmScale = ctm === null ? 1 : Math.hypot(ctm.a, ctm.b);
    const pad = stroked ? ((parseFloat(style.strokeWidth) || 0) / 2) * ctmScale : 0;
    x0 = Math.min(x0, r.left - pad);
    y0 = Math.min(y0, r.top - pad);
    x1 = Math.max(x1, r.right + pad);
    y1 = Math.max(y1, r.bottom + pad);
  }
  if (!Number.isFinite(x0)) return null;
  return { x: (x0 - root.left) / scale, y: (y0 - root.top) / scale, w: (x1 - x0) / scale, h: (y1 - y0) / scale };
};

/**
 * Debug only. After the frame paints, measures every element marked
 * data-readable, logs the boxes for scripts/safecheck.ts, and outlines them:
 * green when clear of the platform's interface, red when not.
 */
export const ReadableProbe: React.FC<{ platform: TargetId }> = ({ platform }) => {
  const frame = useCurrentFrame();
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<{ name: string; box: Box }[] | null>(null);
  const [handle] = useState(() => delayRender("Measuring readable elements"));

  useLayoutEffect(() => {
    // Scope to this copy of the frame: Remotion can hold a second, zero-size copy off screen.
    const frameEl = ref.current?.closest("[data-tally-frame]") ?? null;
    if (frameEl === null) return;
    void document.fonts.ready.then(() => {
      // The frame-sized scene <svg> gives the origin and scale; the container itself can measure 0 x 0.
      const sceneSvg = frameEl.querySelector("svg");
      const root = (sceneSvg ?? frameEl).getBoundingClientRect();
      const scale = root.width > 0 ? root.width / FRAME.width : 1;
      const found = Array.from(frameEl.querySelectorAll("[data-readable]"))
        .map((el) => ({ name: el.getAttribute("data-readable") ?? "?", box: measure(el, root, scale) }))
        .filter((x): x is { name: string; box: Box } => x.box !== null && x.box.w > 0 && x.box.h > 0);
      const report: ProbeReport = { frame, platform, items: found };
      console.log(PROBE_PREFIX + JSON.stringify(report));
      setItems(found);
    });
  }, [frame, platform]);

  // Release the frame only once the outlines are on the page.
  useLayoutEffect(() => {
    if (items !== null) continueRender(handle);
  }, [items, handle]);

  const zones = blockedZonesFor(platform);
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div ref={ref} />
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        {(items ?? []).map((it, i) => {
          const bad = zones.some((z) => intersects(it.box, z));
          return (
            <rect
              key={i}
              x={it.box.x}
              y={it.box.y}
              width={it.box.w}
              height={it.box.h}
              fill="none"
              stroke={bad ? DEBUG.fail : DEBUG.pass}
              strokeWidth={4}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
