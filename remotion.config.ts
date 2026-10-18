/**
 * Applies to `npm run studio` only. The render, safecheck and verify scripts use
 * the Node APIs and pass the same options directly (see scripts/lib/remotion.ts).
 */
import { Config } from "@remotion/cli/config";

Config.setPublicDir("./assets");
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(1);
