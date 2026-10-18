import { AbsoluteFill } from "remotion";
import { ensureFonts } from "../fonts";
import { cardLayout, FRAME, HORIZON_Y, NIGHT_DOOR_WINDOW, PRINT_BOX, VANISHING_POINT } from "../layout";
import { CHARACTER, PALETTE, SKY } from "../palette";
import { UNIVERSAL_STAGE } from "../platforms";
import { Card } from "../primitives/Card";
import { Car } from "../primitives/Car";
import { Dust } from "../primitives/Dust";
import { Figure } from "../primitives/Figure";
import { Fragments } from "../primitives/Fragments";
import { Ground } from "../primitives/Ground";
import { Print } from "../primitives/Print";
import { Radio } from "../primitives/Radio";
import { Rain } from "../primitives/Rain";
import { Road } from "../primitives/Road";
import { Sky } from "../primitives/Sky";
import { Smudge } from "../primitives/Smudge";
import { Sun } from "../primitives/Sun";
import { originForCabWindow, Vehicle } from "../primitives/Vehicle";

ensureFonts();

/** Dev only: every primitive on one frame, for eyeballing. */
export const Gallery: React.FC = () => {
  const card = cardLayout(UNIVERSAL_STAGE, { dayText: "DAY 12", marks: 7, struck: [5] });
  const cab = originForCabWindow(NIGHT_DOOR_WINDOW);
  return (
    <AbsoluteFill>
      <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
        <Sky colours={SKY.dusk} horizonY={HORIZON_Y} id="g-sky" />
        <Ground colour={SKY.drained.ground} horizonY={HORIZON_Y} horizonLine={null} />
        <Smudge centre={{ x: 160, y: HORIZON_Y }} width={220} height={60} colour={PALETTE.ink} seed={3} />
        <Sun centre={{ x: 880, y: 1000 }} radius={52} colour={PALETTE.text} opacity={0.6} />
        <Dust horizonY={HORIZON_Y} colour={PALETTE.daySky} drift={40} seed={7} />
        <Road
          projection={{ vp: VANISHING_POINT, pxPerUnit: 457 }}
          halfWidth={0.875}
          colour={PALETTE.road}
          dashColour={PALETTE.roadDash}
          travelled={0.4}
        />
        <Car base={{ x: 300, y: 1420 }} scale={0.8} colour={PALETTE.roadDash} doorColour={PALETTE.roadDash} doorSide={-1} />
        <Vehicle
          origin={cab.origin}
          scale={cab.scale}
          trailers={1}
          colours={{ body: PALETTE.ink, window: PALETTE.nightHorizon, wheel: PALETTE.ink, rail: PALETTE.ink, door: PALETTE.nightHorizon }}
        />
        <Print box={PRINT_BOX} colour={PALETTE.text} opacity={0.3} />
        <Figure base={{ x: 300, y: 1800 }} colour={CHARACTER.cal} scale={1} facing="right" mouthCurve={-1} />
        <Figure base={{ x: 540, y: 1800 }} colour={CHARACTER.june} scale={1.15} facing="camera" mouthCurve={0} />
        <Figure base={{ x: 760, y: 1800 }} colour={CHARACTER.toby} scale={0.7} facing="left" mouthCurve={1} arms={[-30, 40]} legs={[20, -20]} />
        <Figure base={{ x: 920, y: 1800 }} colour={CHARACTER.hollis} scale={1} facing="camera" mouthCurve={0} />
        <Rain area={{ x: 700, y: 200, w: 300, h: 400 }} density={6} colour={PALETTE.ink} seed={11} fallen={300} />
        <Fragments source={{ x: 600, y: 400, w: 80, h: 30 }} count={14} size={[6, 6]} colour={PALETTE.text} seed={5} fallen={120} floorY={700} />
        <Radio at={{ x: 120, y: 1560 }} body={PALETTE.road} light={PALETTE.text} level={1} />
        <Card geometry={card} dayText="DAY 12" strokeProgress={() => 1} strikeProgress={() => 1} />
      </svg>
    </AbsoluteFill>
  );
};
