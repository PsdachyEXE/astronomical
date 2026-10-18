/**
 * The effects library. Each slot names its file under assets/sfx, whether it
 * loops, and where it came from. `placeholder: true` means the file is a
 * stand-in synthesised by scripts/make-sfx.ts; replace it with a CC0 file and
 * flip the flag (and the manifest) when one can be fetched.
 */
export type SfxId =
  | "click"
  | "rumble"
  | "glass"
  | "boom"
  | "ring"
  | "footstep"
  | "wind"
  | "static-sweep"
  | "static-bed"
  | "bang"
  | "drone";

export type SfxSlot = {
  id: SfxId;
  file: string;
  loop: boolean;
  description: string;
  placeholder: boolean;
  source: string;
  licence: string;
};

const SYNTH = "Synthesised in-repo by scripts/make-sfx.ts (seeded, deterministic)";
const OURS = "CC0 1.0 (made for this project)";

const slot = (id: SfxId, loop: boolean, description: string): SfxSlot => ({
  id,
  file: `sfx/${id}.wav`,
  loop,
  description,
  placeholder: true,
  source: SYNTH,
  licence: OURS,
});

export const SFX: Record<SfxId, SfxSlot> = {
  click: slot("click", false, "Click (radio): the press-to-talk click at the start and end of a transmission"),
  rumble: slot("rumble", true, "Low rumble, 8 s, loopable"),
  glass: slot("glass", false, "Glass shatter"),
  boom: slot("boom", false, "Deep boom with sub drop"),
  ring: slot("ring", false, "High ring, 8 s, decaying"),
  footstep: slot("footstep", false, "One footstep on gravel"),
  wind: slot("wind", true, "Wind bed, loopable, 30 s"),
  "static-sweep": slot("static-sweep", false, "Static sweep: the radio finding a signal"),
  "static-bed": slot("static-bed", true, "Static bed, loopable"),
  bang: slot("bang", false, "One door bang on hollow metal"),
  drone: slot("drone", true, "Night drone, 50 Hz, loopable"),
};

export const SFX_IDS = Object.keys(SFX) as SfxId[];

export const isSfxId = (value: string): value is SfxId =>
  Object.prototype.hasOwnProperty.call(SFX, value);

/** What the timeline needs to know about each effect file, measured from the file. */
export type SfxIndex = Record<string, { file: string; duration: number; loop: boolean; placeholder: boolean }>;
