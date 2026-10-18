# Decisions

One line of reasoning per call. Grouped by build-brief step. Spec contradictions are marked **Spec conflict**.

## Step 1: scaffold

- **Remotion 4.0.536 via `npx create-video@latest --yes --blank`, React 19.** Latest stable on the day; the blank template is the smallest base that still matches the CLI's expectations.
- **Renders use Remotion's Node APIs (`@remotion/bundler`, `@remotion/renderer`), not shell calls to `npx remotion render`.** Same engine as the CLI, but one bundle serves six renders, the safe-zone stills and the pixel test, and the scripts can read browser logs.
- **The Remotion public dir is `assets/`.** The spec's layout puts effects in `assets/sfx` and voice in `assets/voice`; serving that folder directly avoids a copy step that could drift.
- **Browser: `REMOTION_BROWSER_EXECUTABLE`, else Playwright's headless shell under `PLAYWRIGHT_BROWSERS_PATH`, else Remotion's own download.** Remotion's downloader ignores the HTTPS proxy in this container; on a normal machine the third option just works.
- **IBM Plex Mono (Regular, SemiBold) TTFs fetched from the google/fonts repository and committed under `assets/fonts` with the OFL.** The brief allows Plex Mono or Space Mono; Plex has the clearer digits at caption size.
- **The planning doc is split verbatim by line range into the four `docs/` files.** They are the spec, so no heading or note is added to them.
- **Finished deliverables in `out/` are committed; intermediates are ignored.** The container that built them is temporary and the deliverables list names the files.
- **`"type": "module"` in package.json.** Scripts (tsx) and the Remotion bundle then share the same ES module imports from `src/`.

## Step 2: palette, layout, platforms

- **Each platform's stage is its measured interface plus a fixed pad (top 10, bottom 20, sides 12).** With that pad the worst case of each edge reproduces the bible's universal stage exactly, so the universal stage is the intersection of the five platform stages rather than a separate number to keep in sync.
- **YouTube's bottom margin uses the expanded-description figure, 360 px, not 300.** The bible's universal bottom (380) only adds up with 360, and the expanded state is what a viewer who taps sees.
- **Captions sit 100 px above the stage's bottom edge; cards sit 20 px above the stage's centre.** On the universal stage that is y 1440 and y 860, as the bible says; on a platform stage the captions keep the same clearance from that platform's own bottom interface.
- **The hidden figure and the handprint are placed once, inside the universal stage, not per platform.** They are part of the scenery, scenery must be pixel-identical across variants, and the universal stage sits inside every platform's stage.
- **Spec conflict: the prompt puts an end-card hold in each platform entry, and also says variants may differ only in stage, captions and encode.** The field exists per platform but every value is 1.5 s and a test holds them equal; a different hold would change the runtime.
- **Added `black #000000` to the palette.** The cue table says "Black." and "cut to black" but the palette table has no black; ink is reserved for rain, Hollis and the smudges.
- **"Drained" applies the 20% grey mix to the ground as well as the sky.** The cue table says "the drained day palette", and a drained sky over a saturated ground reads as a colour error.
- **Dusk ground is the drained ground mixed 60% toward night.** The palette has no dusk ground and the cab windscreen shows ground below the horizon.
- **Mouths are ink, except on ink figures (Hollis and his people), where they are the night-horizon navy.** An ink mouth on an ink head would vanish, and a mouth that barely shows suits people who "can stand in the dark and not be there".
- **Encode presets are house choices: H.264 high, level 4.1, CRF 16 to 20, AAC 192 kbps, a peak cap per platform.** No platform publishes upload numbers that bind for flat-colour animation, and every platform re-encodes anyway.
- **Platform length limits are recorded with their source; the runtime guard (62 to 170 s) is a separate constant tested to sit inside every window.** The guard is the prompt's rule, the limits are the facts it rests on.
