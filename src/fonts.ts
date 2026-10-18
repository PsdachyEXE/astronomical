import { continueRender, delayRender, staticFile } from "remotion";

/** The one monospace face, bundled locally (assets/fonts, OFL). */
export const FONT_FAMILY = "TallyMono";

const FACES = [
  { file: "fonts/IBMPlexMono-Regular.ttf", weight: "400" },
  { file: "fonts/IBMPlexMono-SemiBold.ttf", weight: "600" },
] as const;

let loading: Promise<void> | null = null;

/** Loads both weights once per page and holds the render until they are ready. */
export const ensureFonts = (): void => {
  if (loading !== null || typeof document === "undefined") return;
  const handle = delayRender("Loading IBM Plex Mono");
  loading = Promise.all(
    FACES.map(async (face) => {
      const font = new FontFace(FONT_FAMILY, `url('${staticFile(face.file)}') format('truetype')`, {
        weight: face.weight,
      });
      await font.load();
      document.fonts.add(font);
    }),
  ).then(
    () => continueRender(handle),
    (err: unknown) => {
      throw err instanceof Error ? err : new Error(String(err));
    },
  );
};
