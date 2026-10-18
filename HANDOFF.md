# Handoff: Milestone 1

- **Done.** Branch `milestone-1`: `episodes/ep01.json` renders to `out/ep01.master.mp4` (73.50 s, -16.4 LUFS, -2.3 dBTP) and five platform variants. `npm run verify -- ep01` passes all ten acceptance tests and `npm test` passes 41 unit tests. Every judgement call and spec conflict is in `DECISIONS.md`.
- **Placeholder: the voice.** No TTS provider is wired yet: clips are silent with a start tone (placeholder mode). This waits on your two answers, the provider plus a key (I suggest ElevenLabs, with Azure as the cheaper fallback) and the narrator's gender.
- **Placeholder: all eleven sound effects** are synthesised in-repo (`assets/MANIFEST.md`), because freesound.org, kenney.nl and opengameart.org were blocked by this environment's network policy.
- **Placeholder: the loudness figures** were measured on a mix with no voice in it. Re-check them once real narration lands.
- **Pace directions:** C05, C08 and C11 (1.2, 1.05, 1.2) and the radio line (1.1) are sped up, because the doc's table runs faster than 130 wpm. A real voice will shift cue starts, and the timeline absorbs that.
- **Verify on a phone with an unlisted upload.** These were copied from the planning doc on 2026-10-18 and none were re-measured: YouTube bottom 360 / right 96; Instagram top 210 / bottom 310 / right 84; TikTok top 108 / bottom 320 / left 60 / right 120; Snapchat 150 / 330 / 60 / 60; Facebook top 100 / bottom 300, no side margins.
- Also check the Facebook Reels and Spotlight length caps. Correct only `src/platforms.ts`, then rerun `npm run safecheck`.
- System ffmpeg 6.1 was present. Without it, renders skip the radio filter and the loudness pass and say so (`--no-ffmpeg` forces that path).
- **Episode 2, once `docs/ep02.md` exists** (`new-episode` scaffolds `episodes/ep02.json` and runs TTS; read its report):
  `npm run new-episode -- docs/ep02.md`
  `npm run timeline -- ep02 && npm run render -- ep02 --platform all && npm run safecheck -- ep02 && npm run post-meta -- ep02`
- **Before that works for the real Episode 2:** its footprints, body and car radio need new scene components. The converter names any scene it can't place.
