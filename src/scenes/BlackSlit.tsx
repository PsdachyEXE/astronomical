import { FRAME } from "../layout";
import { after } from "../motion";
import { PALETTE } from "../palette";
import { Backdrop } from "../primitives/Backdrop";
import { Slit } from "../primitives/Slit";
import type { SceneProps } from "./common";
import type { BlackSlitState } from "./models";

/** Where the slit sits: low in frame, the gap under a trailer seen from beneath it. */
const SLIT_Y = 1470;
const SLIT_HEIGHT = 7;

export const BlackSlitScene: React.FC<SceneProps<BlackSlitState>> = ({ state, t }) => (
  <svg width={FRAME.width} height={FRAME.height} viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}>
    <Backdrop colour={PALETTE.black} />
    {state.slitAt !== null && after(t, state.slitAt) ? (
      <Slit y={SLIT_Y} height={SLIT_HEIGHT} colour={PALETTE.daySky} />
    ) : null}
  </svg>
);
