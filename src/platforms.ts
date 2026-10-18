/**
 * One entry per platform, plus `universal` (the worst case of every edge) and
 * `master` (the file that can go anywhere, laid out on the universal stage).
 *
 * A platform variant may differ from the master only in the stage used for
 * layout, the caption toggle and the encode preset. tests/platforms.test.ts
 * and the pixel check in scripts/verify.ts enforce that.
 *
 * SAFE-ZONE NUMBERS ARE THIRD-PARTY MEASUREMENTS. Platforms change their
 * interfaces without notice. Every number below says where it came from and
 * when. Re-measure against an unlisted test upload on a real phone before
 * launch and after any interface change, then edit only this file.
 */
import { blockedZones, insetFrame, STAGE_PAD, type Box, type Margins } from "./layout";

export type PlatformId = "youtube" | "instagram" | "snapchat" | "tiktok" | "facebook";
export type TargetId = PlatformId | "universal" | "master";

export const PLATFORM_IDS: readonly PlatformId[] = [
  "youtube",
  "instagram",
  "snapchat",
  "tiktok",
  "facebook",
];
export const TARGET_IDS: readonly TargetId[] = ["master", "universal", ...PLATFORM_IDS];

export const isTargetId = (value: string): value is TargetId =>
  (TARGET_IDS as readonly string[]).includes(value);

export type EncodePreset = {
  /** x264 constant rate factor. Flat-colour animation compresses well, so caps rarely bind. */
  crf: number;
  x264Preset: "slow" | "medium";
  /** Peak video bitrate cap; null for none. */
  maxrateKbps: number | null;
  profile: "high";
  level: "4.1";
  audioKbps: 192;
  audioSampleRate: 48000;
};

export type Source = { what: string; url: string; retrieved: string };

export type PlatformConfig = {
  id: TargetId;
  label: string;
  /** Pixels the platform's interface covers on each edge of the 1080 x 1920 frame. */
  safeZone: Margins;
  safeZoneSource: Source;
  /** Platform length limits in seconds, with where they came from. */
  duration: { min: number; max: number; source: string };
  encode: EncodePreset;
  /** Burned-in captions on or off. Turning them off changes nothing else. */
  captions: boolean;
  /** Seconds the closing tally card holds. Must equal the master's; see DECISIONS.md. */
  endCardHold: number;
};

const DOC_TABLE = "TALLY planning doc, bible \"Canvas and safe zones\" table";
const ADAPTLY: Source = {
  what: `adaptlypost, "Social media safe zones 2026: complete guide", via the ${DOC_TABLE}`,
  url: "https://adaptlypost.com/en/blog/social-media-safe-zones-2026-complete-guide",
  retrieved: "2026-10-18 (copied from the doc; not re-measured)",
};

const preset = (crf: number, maxrateKbps: number | null): EncodePreset => ({
  crf,
  x264Preset: "slow",
  maxrateKbps,
  profile: "high",
  level: "4.1",
  audioKbps: 192,
  audioSampleRate: 48000,
});

/**
 * Encode presets are house choices, not platform-published numbers: H.264
 * high profile, 30 fps, AAC 192 kbps at 48 kHz, with a peak cap under what
 * each app is commonly reported to re-encode to. Every platform re-encodes.
 */
const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  youtube: {
    id: "youtube",
    label: "YouTube Shorts",
    // Bottom is the expanded-description figure (300 px collapsed, 360 expanded).
    safeZone: { top: 120, bottom: 360, left: 0, right: 96 },
    safeZoneSource: ADAPTLY,
    duration: {
      min: 0,
      max: 180,
      source: "Shorts cap of three minutes, as stated in the TALLY planning doc (2026-10-18)",
    },
    encode: preset(18, 16000),
    captions: true,
    endCardHold: 1.5,
  },
  instagram: {
    id: "instagram",
    label: "Instagram Reels",
    safeZone: { top: 210, bottom: 310, left: 0, right: 84 },
    safeZoneSource: ADAPTLY,
    duration: {
      min: 0,
      max: 180,
      source: "Reels cap of three minutes, as stated in the TALLY planning doc (2026-10-18)",
    },
    encode: preset(20, 8000),
    captions: true,
    endCardHold: 1.5,
  },
  snapchat: {
    id: "snapchat",
    label: "Snapchat Spotlight",
    safeZone: { top: 150, bottom: 330, left: 60, right: 60 },
    safeZoneSource: {
      what: `Snap guidance via AdKit's safe-zone tool, via the ${DOC_TABLE}`,
      url: "https://adkit.so/tools/safe-zones/snapchat",
      retrieved: "2026-10-18 (copied from the doc; not re-measured)",
    },
    duration: {
      min: 62,
      max: 180,
      source:
        "Spotlight cap of three minutes; monetisation length threshold put at 30 or 60 s (Epidemic Sound, via the planning doc). 62 s clears both",
    },
    encode: preset(20, 8000),
    captions: true,
    endCardHold: 1.5,
  },
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    safeZone: { top: 108, bottom: 320, left: 60, right: 120 },
    safeZoneSource: ADAPTLY,
    duration: {
      min: 62,
      max: 600,
      source:
        "Creator Rewards needs videos over one minute (planning doc, 2026-10-18); 62 s adds a margin. 600 s is the in-app upload length, unverified",
    },
    encode: preset(20, 10000),
    captions: true,
    endCardHold: 1.5,
  },
  facebook: {
    id: "facebook",
    label: "Facebook Reels",
    safeZone: { top: 100, bottom: 300, left: 0, right: 0 },
    safeZoneSource: ADAPTLY,
    duration: {
      min: 0,
      max: 180,
      source:
        "The planning doc's three-minute cap on Reels. Facebook's own Reels limit has moved more than once; verify in the composer",
    },
    encode: preset(20, 8000),
    captions: true,
    endCardHold: 1.5,
  },
};

const worstCase = (pick: (m: Margins) => number): number =>
  Math.max(...PLATFORM_IDS.map((id) => pick(PLATFORMS[id].safeZone)));

/** The union of every platform's interface: what the master must clear. */
const UNIVERSAL_ZONE: Margins = {
  top: worstCase((m) => m.top),
  bottom: worstCase((m) => m.bottom),
  left: worstCase((m) => m.left),
  right: worstCase((m) => m.right),
};

const universal: PlatformConfig = {
  id: "universal",
  label: "Universal",
  safeZone: UNIVERSAL_ZONE,
  safeZoneSource: {
    what: "Worst case of each edge across the five platforms above",
    url: "src/platforms.ts",
    retrieved: "computed",
  },
  duration: {
    min: Math.max(...PLATFORM_IDS.map((id) => PLATFORMS[id].duration.min)),
    max: Math.min(...PLATFORM_IDS.map((id) => PLATFORMS[id].duration.max)),
    source: "Tightest window across the five platforms",
  },
  encode: preset(16, null),
  captions: true,
  endCardHold: 1.5,
};

const CONFIGS: Record<TargetId, PlatformConfig> = {
  ...PLATFORMS,
  universal,
  master: { ...universal, id: "master", label: "Master" },
};

export const platformConfig = (id: TargetId): PlatformConfig => CONFIGS[id];

export const platformIdsForTarget = (target: TargetId): readonly PlatformId[] =>
  target === "master" || target === "universal" ? PLATFORM_IDS : [target];

/** The stage a target lays readable elements out on. */
export const stageFor = (id: TargetId): Box => {
  const zone = CONFIGS[id].safeZone;
  return insetFrame({
    top: zone.top + STAGE_PAD.top,
    bottom: zone.bottom + STAGE_PAD.bottom,
    left: zone.left + STAGE_PAD.left,
    right: zone.right + STAGE_PAD.right,
  });
};

/** The interface bands for a target; the master's are the union of all five. */
export const blockedZonesFor = (id: TargetId): Box[] => blockedZones(CONFIGS[id].safeZone);

export const UNIVERSAL_STAGE: Box = stageFor("universal");

/**
 * The episode runtime guard. 62 s is the floor TikTok's and Snapchat's
 * programmes require (one minute plus a margin); 170 s keeps ten seconds
 * under the three-minute caps on Shorts, Reels and Spotlight.
 */
export const DURATION_GUARD = { min: 62, max: 170 } as const;

/** Every target shares the master's end-card hold, so the timeline is platform-free. */
export const END_CARD_HOLD = CONFIGS.master.endCardHold;
