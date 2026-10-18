import type { Box, Point } from "../layout";

/**
 * Road train, side-on, at 1.0 scale: a 300 x 200 cab with an inset window,
 * 520 x 170 trailers raised on a rail, radius-28 wheels. Local origin is the
 * ground directly below the cab's rear edge; the cab faces +x and trailers
 * run toward -x.
 */
export const VEHICLE = {
  cab: { x: 0, y: -240, w: 300, h: 200 },
  cabWindow: { x: 165, y: -222, w: 120, h: 78 },
  door: { x: 150, y: -232, w: 142, h: 184 },
  cabWheels: [60, 240],
  wheelRadius: 28,
  trailer: { w: 520, h: 170, gap: 24, bottom: -112 },
  rail: { h: 16 },
  trailerWheels: [70, 130, 460],
  strut: 6,
  coupling: 6,
} as const;

/** The cab window in frame coordinates, for a vehicle placed at `origin` and `scale`. */
export const cabWindowRect = (origin: Point, scale: number): Box => ({
  x: origin.x + VEHICLE.cabWindow.x * scale,
  y: origin.y + VEHICLE.cabWindow.y * scale,
  w: VEHICLE.cabWindow.w * scale,
  h: VEHICLE.cabWindow.h * scale,
});

/** Where to put a vehicle so its cab window lands exactly on `window`. */
export const originForCabWindow = (window: Box): { origin: Point; scale: number } => {
  const scale = window.w / VEHICLE.cabWindow.w;
  return {
    scale,
    origin: { x: window.x - VEHICLE.cabWindow.x * scale, y: window.y - VEHICLE.cabWindow.y * scale },
  };
};

/** Left edge (local x) of trailer k, counting from the cab. */
export const trailerLeft = (k: number): number =>
  -(k + 1) * (VEHICLE.trailer.w + VEHICLE.trailer.gap) + VEHICLE.trailer.gap;

export type VehicleColours = {
  body: string;
  window: string;
  wheel: string;
  rail: string;
  /** Outline of the door; null hides it. */
  door: string | null;
};

export type VehicleProps = {
  origin: Point;
  scale: number;
  trailers: number;
  colours: VehicleColours;
  /** Horizontal offset of the door (and its window) in px at 1.0 scale. */
  doorOffset?: number;
  /** Drawn inside the window, under the glass (a person in the cab). */
  windowContents?: React.ReactNode;
  /** Drawn on top of the window (marks on the glass). */
  windowSurface?: React.ReactNode;
};

export const Vehicle: React.FC<VehicleProps> = ({
  origin,
  scale,
  trailers,
  colours,
  doorOffset = 0,
  windowContents = null,
  windowSurface = null,
}) => {
  const v = VEHICLE;
  const t = v.trailer;
  const railTop = t.bottom;
  const railBottom = t.bottom + v.rail.h;
  const wheelY = -v.wheelRadius;
  const units = Array.from({ length: trailers }, (_, k) => trailerLeft(k));
  return (
    <g transform={`translate(${origin.x} ${origin.y}) scale(${scale})`}>
      {units.map((left, k) => (
        <g key={k}>
          {v.trailerWheels.map((wx) => (
            <g key={wx}>
              <rect
                x={left + wx - v.strut / 2}
                y={railBottom}
                width={v.strut}
                height={wheelY - railBottom}
                fill={colours.rail}
              />
              <circle cx={left + wx} cy={wheelY} r={v.wheelRadius} fill={colours.wheel} />
            </g>
          ))}
          <rect x={left} y={railTop} width={t.w} height={v.rail.h} fill={colours.rail} />
          <rect x={left} y={railTop - t.h} width={t.w} height={t.h} fill={colours.body} />
          <rect
            x={left + t.w}
            y={railTop + v.rail.h / 2 - v.coupling / 2}
            width={t.gap}
            height={v.coupling}
            fill={colours.rail}
          />
        </g>
      ))}
      {v.cabWheels.map((wx) => (
        <circle key={wx} cx={wx} cy={wheelY} r={v.wheelRadius} fill={colours.wheel} />
      ))}
      <rect x={v.cab.x} y={v.cab.y} width={v.cab.w} height={v.cab.h} fill={colours.body} />
      <g transform={`translate(${doorOffset} 0)`}>
        {colours.door === null ? null : (
          <rect
            x={v.door.x}
            y={v.door.y}
            width={v.door.w}
            height={v.door.h}
            fill={colours.body}
            stroke={colours.door}
            strokeWidth={4}
          />
        )}
        <svg
          x={v.cabWindow.x}
          y={v.cabWindow.y}
          width={v.cabWindow.w}
          height={v.cabWindow.h}
          viewBox={`0 0 ${v.cabWindow.w} ${v.cabWindow.h}`}
          overflow="hidden"
        >
          <rect x={0} y={0} width={v.cabWindow.w} height={v.cabWindow.h} fill={colours.window} />
          {windowContents}
        </svg>
        {windowSurface}
      </g>
    </g>
  );
};
