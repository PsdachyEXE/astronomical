## Build brief for Claude Code

Hand this section to Claude Code as its first prompt, with the rest of the doc exported to Markdown beside it. Milestone 1 is Episode 1 rendered end to end from a script file.

### Goal

A command-line pipeline that turns one episode script file into a finished 1080 × 1920 master MP4 plus per-platform variants for YouTube Shorts, Instagram Reels, Snapchat Spotlight, TikTok and Facebook Reels, with narration, radio voices and sound effects synced to the narration's measured timing, a safe-zone check that proves every readable element clears each platform's interface, and a design that lets a second episode go through without touching the code.

### Current state

Nothing is built. This document is the spec: the bible sections define the look and sound, the Episode 1 table is the first input, and the arc table is the next 29 inputs.

### Decisions and rationale

| Decision | Choice | Why | Rejected |
| --- | --- | --- | --- |
| Renderer | Remotion (React and TypeScript) | Scenes are data-driven components, it renders from the CLI, and audio is mixed inside the composition | Motion Canvas: better for hand-timed animation, worse for batch rendering from data. A video editor: not driven by a script file |
| Timing | Per-line TTS, measured, then computed | Every narration line is its own clip; the build measures the clips and sets cue starts from them, so sync is exact instead of estimated | One long narration file with guessed timings |
| Word triggers | The provider's word timestamps, else forced alignment | The flash has to land on "white"; the fallback is 85% of the clip | Splitting a sentence into two clips, which breaks the prosody |
| Script format | One JSON file per episode; the markdown cue table is the human copy | The JSON is the renderer's single source of truth, the table is what gets written and edited; Episode 1 is converted by hand, then a converter is written | Hard-coding scenes in components |
| Platform adaptability | One master, a universal stage, a per-platform config | Scenery bleeds full-frame and readable content sits where no platform's interface covers it; a per-platform render changes only the stage rectangle, the caption toggle and the encode preset | Five hand-adjusted edits per episode |
| Captions | Burned in by default, word-timed from the TTS timestamps, toggled per platform | Most viewers watch muted, and the timing data already exists | Relying on each platform's auto-captions |
| Audio mix | Remotion Audio for narration and effects; ffmpeg for the radio filter and the loudness pass | The mix stays in the composition, the mastering stays outside it | A DAW in the loop |
| Fonts | One monospace from Google Fonts (IBM Plex Mono or Space Mono), bundled locally | Licence-clean, renders the same on every machine | System fonts |
| Licence | Remotion is free for individuals and small teams under its own licence; confirm the current terms before any company use |  |  |

### Episode JSON, the shape

```json
{
  "episode": 1,
  "day": 1,
  "tally": { "open": 1, "close": 1, "changes": [] },
  "voices": { "narrator": "cal", "radio": "authority" },
  "cues": [
    {
      "id": "C05",
      "scene": "roadtrain-side",
      "state": { "time": "drained", "cal": { "pose": "under-trailer", "move": "still" }, "dust": { "drift": 20 } },
      "narration": [
        { "voice": "cal", "text": "Then the sound came.", "pauseBefore": 0.4 },
        { "voice": "cal", "text": "Then nothing, for a long time.", "pauseBefore": 1.2 }
      ],
      "triggers": [],
      "sfx": [ { "file": "ring", "at": -2.0, "gain": -10, "fadeOut": 5.5 } ],
      "minDuration": 5.5,
      "holdAfter": 0.5
    }
  ]
}
```

Rules the timeline builder enforces: a cue starts where the previous one ends; its duration is the larger of `minDuration` and the sum of its pauses, clip lengths and `holdAfter`; `at` on an effect is seconds from the cue start and may be negative; a trigger fires at the measured onset of its word; a tally change is a `changes` entry with a cue id, and the builder inserts the 1.2-second card there.

### Primitives

`Figure` (colour, scale, facing, mouthCurve, pose, move), `Vehicle` (cab, trailers), `Sky` (day, drained, dusk, night, flash, with a transition parameter), `Ground`, `Road` (scroll speed), `Rain` (density, colour), `Dust`, `Card` (day, tally with draw-on and strike), `Radio` (active). Scenes compose these from cue state and nothing is drawn outside them.

### Next actions, in order

1. Scaffold with `npx create-video@latest`: TypeScript strict, a 1080 × 1920 composition at 30 fps, folders `episodes/`, `assets/sfx/`, `assets/voice/`, `docs/`, `out/`.
2. `src/palette.ts`, `src/layout.ts` and `src/platforms.ts` from the Visual language section: every colour, the per-platform safe-zone margins, the universal stage, the duration limits (62 to 170 s), the encode presets and the caption toggle live there and nowhere else. The composition takes `platform` as a prop and reads its stage from this file.
3. Primitives: `Figure` first, with the mouth-only face and the facing rule; then `Card` with stroke draw-on and strike; then `Sky`, `Ground`, `Road`; then `Vehicle`, `Rain`, `Dust`, `Radio`. Scenery is positioned against the full frame; readable elements are positioned against the stage.
4. `src/motion.ts` exporting idle, walk, turn, flinch, collapse, still and strike as functions of frame. Nothing animates outside these.
5. `scripts/tts.ts`: reads an episode JSON, generates one clip per narration line through the chosen provider, saves the clips and a `timing.json` holding each clip's length and word timestamps, running alignment when the provider gives none. Until a provider is wired, a placeholder mode writes silent clips of the estimated length so the rest of the pipeline runs.
6. `scripts/timeline.ts`: builds the absolute timeline from the episode JSON and `timing.json`, writes `out/ep01.timeline.json`, fails if the runtime is outside the duration limits, and prints a cue table in the same columns as the doc so the two can be compared by eye.
7. Scenes for Episode 1: `black-slit`, `roadtrain-side`, `highway-walk`, `cab-interior`, `cab-exterior-night`, each a pure function of cue state and frame. The highway scene places the hidden figure from the cue state, not from a hard-coded time.
8. Audio: effects placed from the timeline; radio clips pre-filtered with ffmpeg (high-pass 300 Hz, low-pass 3400 Hz, static bed at −24 dB); drone and wind as loops with fades.
9. `src/Captions.tsx`: one line at y 1440 fed by `timing.json`, two rows at most, radio lines at 60% opacity, on or off per platform.
10. Safe-zone check: a debug prop draws every platform's blocked zones over the frame; `scripts/safecheck.ts` renders the card, the highway walk, the night exterior and the end card for each platform into one contact sheet at `out/ep01.safecheck.png` and fails if any readable element intersects a blocked zone.
11. Render the master and the five variants with the Remotion CLI, passing the episode JSON and the platform as props; then an ffmpeg pass to −16 LUFS and −1.5 dBTP, H.264 high profile, AAC 192 kbps; and a PNG of the card frame as the thumbnail.
12. `scripts/post-meta.ts`: writes `out/ep01.post.json` with a title, description and hashtags per platform built from the episode's day and tally.
13. Check against the cue table: the flash lands on "white", the bangs sit in silence, the hidden figure is visible and small, the loop seam is clean, nothing readable leaves the stage on any platform. Fix and re-render until it does.
14. `scripts/new-episode.ts`: scaffolds an episode JSON from a markdown cue table, so Episode 2 is a writing task and not a build.

### Constraints and conventions

- All timings are derived from audio; none are typed into components.
- Renders are deterministic: no randomness without a seeded generator.
- Scenery bleeds to the frame edge; anything readable stays inside the stage for the platform being rendered, and the safe-zone check fails the build if it does not.
- Per-platform variants differ only in stage rectangle, caption toggle and encode preset. Every upload is a clean master; a file downloaded from one platform is never posted to another.
- Every asset is listed in `assets/MANIFEST.md` with its source URL and licence; effects are CC0 only; the TTS provider's commercial licence is confirmed before anything is published.
- No eyes, hands or feet; no gradients except dusk; no camera move except the push; hard cuts only.
- Nothing from Fallout, and no real emergency wording or tones.
- Dialogue is never performed; characters are reported by the narrator, and the radio voices never exceed two sentences.

### Open questions

1. TTS provider: it needs commercial use, word timestamps and, ideally, an Australian voice. Decide before step 5.
2. The narrator voice decides Cal's pronoun. Pick it once.
3. Whether Instagram feed posts need a 4:5 crop. Reels do not, so this can wait.

### File layout

`docs/bible.md`, `docs/ep01.md`, `docs/arc.md` and `docs/build-brief.md` (this doc, exported as Markdown and split), `episodes/ep01.json`, `src/palette.ts`, `src/layout.ts`, `src/platforms.ts`, `src/motion.ts`, `src/primitives/*`, `src/scenes/*`, `src/Captions.tsx`, `src/Episode.tsx`, `scripts/tts.ts`, `scripts/timeline.ts`, `scripts/safecheck.ts`, `scripts/post-meta.ts`, `scripts/new-episode.ts`, `assets/sfx/*`, `assets/voice/ep01/*`, `assets/MANIFEST.md`, `out/ep01.master.mp4`, `out/ep01.<platform>.mp4` for each of the five platforms, `out/ep01.safecheck.png`, `out/ep01.post.json`, `out/ep01.png`.
