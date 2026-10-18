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
