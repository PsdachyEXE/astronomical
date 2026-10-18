# TALLY

A narrator-only animated serial, built from script files. Each episode is a JSON cue list (`episodes/`), written from a markdown cue table (`docs/`), rendered by Remotion into a 1080 × 1920 master and five platform variants.

The spec lives in `docs/` (bible, Episode 1 script, season arc, build brief) and is not edited. Every call made where the spec was silent or contradicted itself is in `DECISIONS.md`.

## Commands

```sh
npm install
npm run tts -- ep01                          # one clip per narration line + timing.json (placeholder voice until a provider is wired)
npm run timeline -- ep01                     # absolute timeline, cue table in the doc's six columns, 62–170 s guard
npm run render -- ep01 --platform master     # out/ep01.master.mp4 (+ out/ep01.png thumbnail)
npm run render -- ep01 --platform all        # master + youtube, instagram, snapchat, tiktok, facebook
npm run safecheck -- ep01                    # out/ep01.safecheck.png: readable elements vs every platform's interface
npm run post-meta -- ep01                    # out/ep01.post.json: title, description, hashtags per platform
npm run new-episode -- docs/ep02.md          # scaffold episodes/ep02.json from a markdown cue table
npm run verify -- ep01                       # the Milestone 1 acceptance tests, against the rendered files
npm test                                     # unit tests
npm run studio                               # Remotion Studio preview
```

System ffmpeg is used for the radio filter and the loudness pass; without it (or with `--no-ffmpeg`) renders still complete, unfiltered and un-normalised, with a warning. Set `REMOTION_BROWSER_EXECUTABLE` to use a local Chrome Headless Shell instead of Remotion's download.

## Where things live

| Path | What |
| --- | --- |
| `src/palette.ts`, `src/layout.ts`, `src/platforms.ts` | Every colour; every readable position; every platform's safe zone (with sources), length limits, encode preset, caption toggle |
| `src/motion.ts` | Every animated value |
| `src/primitives/` | Figure, Card, Sky, Ground, Road, Vehicle, Rain, Dust, Radio and the rest: static drawers |
| `src/scenes/` | Scene models (state, inheritance, time references) and components |
| `src/lib/timeline.ts` | Episode JSON + measured clips → absolute timeline, captions and episode-rule lints |
| `scripts/` | The CLI steps above |
| `assets/` | Effects (synthesised placeholders), voice clips, fonts; licences in `assets/MANIFEST.md` |
