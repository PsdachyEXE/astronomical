import type { SceneProps } from "./common";
import { BlackSlitScene } from "./BlackSlit";
import { CabExteriorNightScene } from "./CabExteriorNight";
import { CabInteriorScene } from "./CabInterior";
import { DayCardScene, EndCardScene, TallyCardScene } from "./Cards";
import { HighwayWalkScene } from "./HighwayWalk";
import type { SceneState } from "./models";
import { RoadtrainSideScene } from "./RoadtrainSide";

/** Draws whichever scene the state names. */
export const SceneView: React.FC<SceneProps<SceneState>> = (props) => {
  const { state } = props;
  switch (state.kind) {
    case "day-card":
      return <DayCardScene {...props} state={state} />;
    case "tally-card":
      return <TallyCardScene {...props} state={state} />;
    case "end-card":
      return <EndCardScene {...props} state={state} />;
    case "black-slit":
      return <BlackSlitScene {...props} state={state} />;
    case "roadtrain-side":
      return <RoadtrainSideScene {...props} state={state} />;
    case "highway-walk":
      return <HighwayWalkScene {...props} state={state} />;
    case "cab-interior":
      return <CabInteriorScene {...props} state={state} />;
    case "cab-exterior-night":
      return <CabExteriorNightScene {...props} state={state} />;
  }
};
