import type { Box } from "../layout";
import type { TargetId } from "../platforms";

/** Console prefix the safe-zone check looks for in the page's log. */
export const PROBE_PREFIX = "TALLY_READABLES ";

export type ProbeReport = { frame: number; platform: TargetId; items: { name: string; box: Box }[] };
