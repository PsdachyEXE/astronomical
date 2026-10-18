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

## Step 3: primitives

- **Primitives are static drawers; anything that moves takes its value (fallen distance, drift, draw progress, bob) as a prop computed in `src/motion.ts`.** That keeps "nothing animates outside motion.ts" checkable by reading one file.
- **Figure proportions: head 72, gap 8, torso 110, legs 50, total 240 px.** The bible fixes head, gap, torso and the 240 px adult, so the legs get what is left.
- **Mouth sits at ±0.56 of the head radius for left/right facing, not the literal third.** A 28 px stroke centred in the outer third would hang off the head.
- **Primitives beyond the brief's list (Sun, Smudge, Car, Fragments, Print, Slit, HorizonLine, CabInterior, Backdrop, Building, Mound).** The brief says scenes draw nothing outside primitives, and Episode 1 needs a sun, smudges, cars, glass, a slit and a dawn line.
- **The handprint primitive is `Print`, and no primitive file mentions body parts.** Acceptance test 9 greps `src/primitives` for "hand", "eye" and "foot".
- **Trailers ride on a rail with 96 px of clearance at 1.0 scale.** Cal has to lie under the second trailer with one arm up to the chassis.
- **Smudges are clusters of ink circles at 45% opacity.** No blur and no gradient, and still reads as smoke on the horizon.
- **Stopped cars are seen from behind in the pale road-dash colour, with the open door as a line.** Against the drained ground an ink car vanishes at the small end of the road.
- **Rain, dust, glass and smudges are placed by a seeded Mulberry32 generator (`src/lib/rng.ts`).** No `Math.random` anywhere.
- **A dev-only `Gallery` composition shows every primitive on one frame.** Step 3 has to end with something that runs.

## Step 4: motion

- **Spec conflict: the bible's motion list is "complete" and "nothing else is animated", but the Episode 1 table directs a jolt, a door shake, falling glass, dust drift, scrolling dashes, sky changes, a radio light and a dawn line.** The seven figure moves stay the complete list for figures; the environment moves the table asks for live in `src/motion.ts` beside them, so nothing animates outside that file.
- **Walk contact lands on every multiple of 0.8 s from the start of the shot.** Footstep sounds use the same grid, so feet and gravel agree without a second clock.
- **Turn uses an ease-in-out over its 6 frames; push is linear.** A mouth that snaps reads as a cut, and a push that eases reads as a move the bible doesn't allow.
- **Flinch is the 2-frame squash first, then the 8 px jump over the remaining 8 frames.** The bible gives the parts and the 10-frame total, not the order; squash-then-jump is the readable one.
- **The jolt picks a fresh seeded offset of 2 to 4 px each frame; the door shake is a fixed decaying pattern peaking at 6 px.** The blast should feel random and the fist should feel the same each time.
- **Glass falls under gravity (2,600 px/s²); rain falls at a steady 1,400 px/s.** The bible gives rain's speed; glass needs to look dropped, not poured.

## Step 5: TTS

- **Spec conflict: at the prompt's 2.17 words a second, C05, C08 and C11 overrun their table durations (by 0.71, 0.09 and 0.43 s), and the Authority message (26 words at the bible's 165 a minute) overruns C09.** Left alone, C06 starts 0.7 s late and the bangs 1.2 s late, failing acceptance tests 2, 4 and 5. Each line may carry a `pace` direction (1 = the voice's natural rate) that a real provider receives as its speaking rate and the placeholder divides into its length. Every Episode 1 line is at 1.0 except C05 (1.2), C08 (1.05), C09 (1.1) and C11 (1.2): the smallest 0.05 steps that land the doc's table.
- **The Authority voice's placeholder pace is the bible's 165 words a minute, not 2.17 words a second.** The prompt's rate describes the narrator; at 2.17 the message alone runs 12 s against a 9 s cue.
- **Placeholder clips carry a 80 ms tone (880 Hz narrator, 1,320 Hz radio) at -18 dBFS, then silence.** Line starts can be checked by ear in the render.
- **timing.json records `wordTiming: "estimated"` for evenly spaced stamps and `"measured"` for provider or aligned stamps.** That is a property of the data, not of the mode, and it is how the 85% trigger fallback applies to placeholder clips without the timeline knowing which provider ran.
- **Clip lengths in timing.json are measured from the written WAV, not taken from the formula.** "Every timing derived from audio" holds even in placeholder mode.
- **Clips are cached by a hash of voice, pace and text; unchanged lines are reused.** A paid provider is then billed once per line, not once per run.
- **Radio clips are band-passed with two cascaded 300 Hz high-pass and 3,400 Hz low-pass stages plus the static bed at -24 dB, by system ffmpeg.** Without ffmpeg the raw clip is used and the script says so.
- **No real TTS provider or forced alignment is wired yet.** That waits on the provider question; the interface (`scripts/lib/tts-providers.ts`) takes one function per provider.

## Effects (built in step 5 because the TTS radio filter and the timeline both need them)

- **All eleven effects are seeded synthesised stand-ins, marked PLACEHOLDER in `assets/MANIFEST.md`.** freesound.org, kenney.nl and opengameart.org were blocked by the build environment's network policy.
- **`assets/MANIFEST.md` and `assets/sfx/index.json` are generated from `src/sfx.ts` and the files.** One source for licences, one measurement for lengths.
- **Loops (rumble, wind, static bed, drone) are built from whole cycles or crossfaded tails, so they repeat without a seam.** The timeline cuts beds on absolute time, so a bed that spans two cues never restarts.
- **The door bang is a struck metal panel: a noise transient over seven inharmonic partials from 92 Hz.** Hollow and low reads as a fist on a cab door, not a hammer on a pipe.

## Step 6: timeline

- **Cues in the same shot inherit the previous cue's resolved state, with times already absolute.** The doc writes "Same." for continuing shots; inheriting means C07 keeps C06's hidden figure from 28.0 s without restating it, and nothing cue-relative gets reinterpreted.
- **Times inside a cue can be references (`"trigger:flash"`, `"line:1:end"`, `"sfx:bang#0+0.2"`, `"end"`) as well as seconds.** Visual events tie to the sound they belong to (glass to the shatter, the jolt to the boom, the door shakes, the window and Cal's jerk to the bangs), so a later TTS that shifts a cue cannot pull picture and sound apart.
- **Spec conflict: the doc's sync rule starts C13's narration 0.4 s after the cue, 0.9 s after the third bang, and acceptance test 4 forbids narration within 1 s of a bang.** C13 waits 0.6 s. A `clear` value on each bang makes the timeline enforce this on every episode.
- **C15's cut to black is a trigger on "why" with the 85% fallback (71.57 s in placeholder mode), not a fixed 2.5 s into the cue.** The doc's 71.5 s is where "why" lands at its pace; with a real voice the cut stays on the word.
- **C10's click and the end of the half-volume loop are anchored to the end of "And again." (51.97 s in placeholder mode) instead of the doc's 51.5 s.** At 51.5 s the click would cut the narrator mid-word; Cal turning the radio off belongs after the line.
- **The flash white holds to the end of C03 and drains in C04 over 1.5 s.** "Holds 0.9 s" is the minimum the trigger's `hold` guarantees; C04 opens on white, so anything else would cut back to day for a fraction of a second.
- **Spec conflict: the radio "never speaks more than two sentences at a time", but the Authority message is five and "verbatim, never varied".** The two-sentence lint applies to every radio line except the verbatim message, and a second lint fails any Authority line that is not word-for-word.
- **A tally change inserts its 1.2-second card immediately before the cue it names.** The brief says "a changes entry with a cue id" and "inserts the card there"; before is the only reading that needs no extra field.
- **The end card lasts the larger of its minDuration and the platform end-card hold.** All targets share 1.5 s, so the timeline stays platform-free.
- **Repeating effects (footsteps) sit on a grid from the shot's start, not the cue's.** C07's footsteps continue C06's rhythm across the cue boundary.
- **Captions are paged against the universal stage's row length (31 characters at 44 px Plex Mono), linger 0.25 s after the line and clear 0.05 s before the next.** Every platform reads the same pages at the same moments.
- **The timeline also lints the episode-shape rules it can check: under 100 narrator words, at most 30 radio words, two voiceless seconds in the climax, a sting that is not a question, hidden-detail words absent from captions, and the tally adding up.** Episode 2 is a writing task; these catch the writing mistakes a build would otherwise ship.
- **A cue that runs past its target is a warning, not an error.** Times in the doc are targets; the error is the runtime guard.

## Step 7: scenes

- **One scene draws per frame, chosen from the timeline, rather than a `<Sequence>` per cue.** Scenes hold no media, so a direct lookup is simpler and keeps every frame a pure function of the timeline and the frame number.
- **The road train is drawn at 0.6 scale so the cab and all three trailers fit across the frame; Cal under it is at 0.55.** At the bible's 1.0 scale the truck is 1,930 px long; "cab and three trailers across the frame" wins over "about 240 px" for this one wide shot.
- **Trailer decks ride 110 px above the ground at 1.0 scale.** Enough room for Cal to lie underneath with one arm reaching the chassis, without the trailers looking stilted.
- **The flash is a full-frame white layer over the scenery, and the drain is that layer's opacity falling to zero over 1.5 s.** "The frame cuts to flash white" means the whole frame, and draining a white layer mixes every colour toward white by the same amount.
- **The highway scene's push is centred on the vanishing point.** The hidden figure stands there, so the push leans toward it without moving it across the frame, and its height stays under 40 px (38.2 at 1.06).
- **The hidden figure is one of Hollis's people: an ink figure at 0.15 scale, facing camera.** The truth section says his people move at night and the banging comes at night; Nine is the only cast in ink.
- **The cab interior is ink except the windscreen; the sun is the text colour at 70%.** "Nothing else gets a colour of its own", and a dull disc in the one pale token reads as a low sun at dusk.
- **At night, the lit window is the text colour at 20% over ink, with Cal as an ink silhouette inside.** "A slightly lighter rectangle", and a lit window is the only way Cal's jerk upright can be seen.
- **The dawn line grows from the right edge at 150 px/s in the day-sky colour.** "Creeps along the horizon"; at that pace it crosses most of the frame by the cut to black.
- **The end card fades the closing tally over its 1.5 s and holds the last two frames pure black.** The loop seam is then black to the DAY card with no fade across it.
