import { existsSync } from "node:fs";
import { join } from "node:path";
import { SFX, SFX_IDS, type SfxIndex } from "../../src/sfx";
import { ASSETS } from "./paths";
import { readWavInfo } from "./wav";

/** Durations measured from the effect files, for the timeline and the composition. */
export const buildSfxIndex = (): SfxIndex => {
  const index: SfxIndex = {};
  for (const id of SFX_IDS) {
    const slot = SFX[id];
    const path = join(ASSETS, slot.file);
    if (!existsSync(path)) throw new Error(`Effect "${id}" is missing: ${path}. Run npm run make-sfx.`);
    index[id] = { file: slot.file, duration: readWavInfo(path).duration, loop: slot.loop, placeholder: slot.placeholder };
  }
  return index;
};
