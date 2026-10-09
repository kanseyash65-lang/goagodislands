# 🎨🔊 08_PROCEDURAL_ASSETS

**There are no asset files.** Claude generates every sprite, texture, icon, font glyph, sound effect, and music note **in code at runtime**. This file is the recipe book.

## 1. Principles

1. **Draw once at boot** into a texture atlas (Canvas2D → `CanvasTexture`). Target: ≤ 1.5 s total, with a loading bar.
2. **Deterministic**: painters use a seeded RNG so art is identical every run.
3. **Palette-first**: one master palette (`art/palette.ts`); shade ramps generated from base colors (dark/mid/light/highlight). Consistent outlines (dark, 1 px at base scale).
4. **Tint-friendly**: draw sprites in **neutral-ish / grayscale-leaning regions** where color commands apply (e.g., chicken body white-ish, villager clothes light gray-blue) so shader tint multiplication produces clean recolors. Keep skin/eyes/outlines in a **non-tinted mask channel** (see 2.2).
5. **Readable silhouettes** at 16–32 px.
6. **Animation by frames + shader wobble**: generate 2–4 frames for walk/idle, plus procedural bob/squash in the vertex shader.

## 2. Atlas

### 2.1 Layout
- Atlas size 2048×2048 (fallback 1024 for low-end). Shelf-pack sprites with 2 px padding + edge bleed to avoid seams.
- `AtlasBuilder.add(key, w, h, paintFn)` returns `{u0,v0,u1,v1}` and stores in `SpriteRegistry`.
- Keep a second small **dynamic atlas** (512×512) for runtime text labels (Thing names, name tags) with LRU eviction.

### 2.2 Tint mask trick
Each sprite is painted into two canvases: **color** and **mask** (white where tint should apply: clothing, fur, leaves; black for eyes/skin/outline). Pack mask in the **alpha-independent second texture** or in a parallel region of the atlas; the shader does `mix(baseColor, baseColor * tint, mask)`. (Simpler alternative: store mask in a second atlas texture with identical UVs.)

### 2.3 Sprite Catalog (minimum set; sizes in px at 1× — draw at 2× and downscale for crispness)

| Group | Sprites (frames) |
|-------|------------------|
| Villagers | body for 6 roles × (idle 2, walk 4, dance 4, panic 2, sleep 1, float 1, pray 2) — **compose from parts** (head, torso, legs, hat, tool) to avoid 100 hand frames; hats/tools differ per role |
| Animals | chicken, cow, sheep, dog, cat, bird (flap 2), duck, frog, dragon (big 48 px, flap 2) |
| Nature | oak ×3 variants, pine ×2, fruit tree, dead tree, stump, bush ×2, flowers ×4 colors, grass tufts ×3, rocks ×3, reeds, lily pad |
| Buildings | house ×4 palettes, market stall, tavern, windmill (blades separate for rotation), well, farm fence pieces, castle (modular: tower, wall, gate), bridge, statue base, tent, haystack |
| Sky | sun (radial glow + rays), moon (phases optional), cloud ×4, star, meteor |
| Effects | spark, smoke puff, fire (4 flicker frames), splash, dust, ring/shockwave, confetti bits, raindrop, snowflake, rune glyphs ×8, sparkle, zzz, heart, exclamation, question mark, music note |
| Props | pizza, coin, egg, frog, duck-drop, meteor rock, "Thing" blob (generic), bucket, ladder (comedy), hat, muscle-arm icon |
| UI-in-world | speech bubble 9-slice, mood icons ×9, selection ring |

### 2.4 Painter Toolkit (`assets/art/`)
- `canvas.ts`: helpers `makeCanvas(w,h)`, `px(ctx,x,y,color)`, `ellipse`, `roundRect`, `blobPath(rng, r, wobble)`.
- `noise.ts`: value/simplex noise 2D for terrain & clouds.
- `ramp.ts`: `makeRamp(baseHex) → {shadow, mid, light, highlight}` via HSL shifts.
- `outline.ts`: post-pass that adds a 1 px outline around non-transparent pixels (ImageData loop, cached).
- `dither.ts`: ordered dithering for stylized gradients.
- Each sprite file exports `paintX(ctx, rng, opts)`; ≤ 80 lines each.

### 2.5 Example Recipes (intent; Claude codes them)

- **Chicken (16×16):** white oval body with ramp, small triangle beak (orange), red comb dots, 2 tiny legs; walk frames shift legs ±1 px + body bob. Mask = body+wing only.
- **Villager (16×24):** head circle (skin ramp), hair/hat by role (straw hat farmer, helmet guard, apron merchant, hard hat builder), torso rect with role color (masked), legs 2 rects; dance frames rotate arms; panic frames: arms up + sweat drop.
- **Oak tree (32×40):** trunk rects + 3–5 overlapping blobs (green ramp) with highlight dabs; mask = leaves.
- **House (32×32):** wall rect with plank lines, roof triangle (palette variant), door, window (emissive channel for night glow), chimney.
- **Sun:** radial gradient disc + 12 ray triangles; color from `Celestial.color` via tint; glow via additive bloom layer.
- **Cloud:** union of 5–7 circles, bottom flattened, soft inner shading.
- **Dragon (48×40):** teal body blob, wings (two frames), horns, tiny fire puff; comedic sad eyes.
- **"Thing" blob:** rounded blob with a doodled face-less sticker look; the label sits above (dynamic atlas).
- **Fire:** 4 frames of layered flame polygons (yellow→orange→red), flicker with random control points.

## 3. Terrain Baking (`rendering/terrain`)

1. Base grass: layered noise → 3–4 green shades, small dither.
2. Paint **river** as a smooth polyline with width variation (shallow edge, deep center), sand banks.
3. **Lake**: noise-warped ellipse. **Mountain ridge**: sprites + shaded ground patch.
4. **Roads**: Catmull-Rom polylines between building doors, dirt ramp + edge noise.
5. **Fields**: striped rectangles near the farm.
6. **Flowers/grass tufts** as separate instanced sprites (not baked) so they can burn/grow.
7. Water tiles animate via a **scrolling-noise shader** over a mask (cheap shimmer).
8. Support **dirty-rect repaints**: burnt (ash), flooded (mud/water), crater, ice (snow).

## 4. Fonts & Text (no font files)

- UI: CSS system stack `ui-rounded, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif`.
- Title logo / newspaper masthead: **procedurally drawn pixel/bitmap font**: define a 5×7 glyph table in code (A–Z, 0–9, punctuation); render to canvas with scaling + shadow. Newspaper body text can use `serif` stack (`Georgia, "Times New Roman", serif`) — system fonts only.
- Canvas text for labels uses the same stacks.

## 5. UI Icons (no images)

Draw with **CSS shapes / inline SVG strings in code / Unicode**. Provide: mic, waveform, undo, redo, spellbook, newspaper, clock, cloud, sun, people, smile, chaos swirl, pray hands, camera. Inline SVG is fine (it's code, not a file).

## 6. Audio — WebAudio Synthesis

### 6.1 Graph
`AudioContext` → buses (`music`, `ambience`, `sfx`, `ui`) → `masterGain` → `DynamicsCompressor` → destination. Master volume + mute persisted (try/catch).

### 6.2 Building Blocks
- `osc(type, freq, env)` (ADSR via `GainNode.gain.setTargetAtTime`), `noise(type)` (pre-generated 2 s white/pink/brown `AudioBuffer`s reused), `filter` (biquad LP/HP/BP with sweeps), `delay/reverb` (convolver from procedurally generated impulse response), `lfo`, `panner`, `bitcrush` (via short `ScriptProcessor`-free approach: waveshaper curve).
- Voice allocation with **polyphony limits** per sound and a global cap (~24 simultaneous).

### 6.3 SFX Recipes (event → sound)

| Event | Recipe |
|-------|--------|
| Command submit | soft "whoosh" (filtered noise sweep up) + sparkle arpeggio (3 sine blips, pentatonic) |
| Command success magnitude-scaled | low sine boom (60→40 Hz) + shimmering saw chord; scale gain/duration by magnitude |
| Improv triggered | wobbly "boing" (sine with fast pitch LFO) + kazoo-ish saw blip |
| Sun color change | rising glassy tone cluster + reverb tail |
| Spawn many | rapid pop train (short sine blips, random pitches), rate-limited |
| Chicken | "bock" = short saw burst 600→300 Hz with formant bandpass; random per-chicken pitch; crowd murmur = noise + many tiny bocks (rate-limited) |
| Cow | low saw 120 Hz + formant sweep (moo) |
| Dog/cat/bird | short filtered bursts / sine chirps |
| Dragon | noise roar through low-pass sweep + sub rumble |
| Rain | pink noise → bandpass 3–5 kHz, gain by intensity; occasional drip blips |
| Wind | brown noise → LP with slow LFO on cutoff |
| Thunder | noise burst → LP 200 Hz long tail with reverb + sub thump |
| Fire | crackle (random short noise clicks) + low roar noise |
| Splash/flood | filtered noise swell |
| Building | hammer taps (short square clicks with pitch jitter), wood creak |
| Meteor | descending whistle (sine 2k→200 Hz) → boom |
| Gravity off | whoosh up + reversed-reverb swell; reverse → "tape stop"-like pitch bend |
| Undo/rewind | tape-rewind (saw pitch glide up with warble + noise) |
| Time stop | low-pass sweep to 200 Hz + silence on ambience |
| Newspaper | paper rustle (noise bursts) + typewriter clacks |
| Prayer posted | gentle chime (two sines, major 3rd) |
| Prayer granted | warm choir pad (detuned saws, LP, slow attack) + sparkle |
| UI click/toggle | tiny blip |
| Villager "voice" | animalese-lite: tiny sine/triangle blips per character with pitch by personality, **very low volume, off by default**, toggle "talky villagers" |

### 6.4 Ambience (always on, crossfaded by state)
- Day: birds (random chirps: sine sweeps), soft wind, distant crickets at dusk, owls at night (two-note sines), water brook (filtered noise) near river zoom, village murmur at low volume.
- Weather layers added on top.

### 6.5 Generative Music Engine
- Key: C major pentatonic / A minor pentatonic; scheduler uses **lookahead (25 ms timer, 120 ms ahead)** with `audioContext.currentTime` for accuracy.
- Layers (each toggled by Chaos 0–10):
  - **Pad** (always): 2–3 detuned saws → LP, slow chord changes every 8 bars (I–vi–IV–V loop with random voicing).
  - **Pluck melody** (chaos ≥ 1): random walk over scale with rests, delay.
  - **Bass** (chaos ≥ 2): sine/triangle root notes.
  - **Percussion** (chaos ≥ 4): kick (sine pitch drop), hat (HP noise), snare (noise+tone). Tempo 80 → 150 BPM with chaos.
  - **Drama layer** (chaos ≥ 7): tremolo strings (saw ensemble), timpani hits, minor chords — comedic over-seriousness.
- Time-of-day adjusts brightness (filter cutoff) and mode (night = minor/less percussion).
- **Time stop:** all layers LP-filter and freeze; **Rewind:** music pitch-glides down.
- Master "Music" toggle + volume. Fade transitions ≥ 1 s. Avoid clipping with the compressor.

### 6.6 Audio Safety
Respect autoplay policy (resume on gesture). Never exceed −6 dBFS peaks. Provide mute hotkey `M` and voice "mute". No loud sudden sounds on load.

## 7. Procedural Names & Text Content

- `names.ts`: first = syllable combos ("Mar"+"tha", "Bo"+"rin") + 40 curated names; surnames by trade ("Thatcher", "Miller", "Chickenworth"-style comedic).
- `headlines.ts`: templates with slots: *"{Subject} {Verb}; Residents '{Reaction}'"*, *"Local {Noun} Declared {Adjective}"*, *"{N} {Things} Reported; Council Requests Calm"*. Subjects/verbs/reactions pools tied to event kinds.
- `classifieds.ts`: ~30 absurd ads ("LOST: one gravity. If found, please return gently.").
- `tips.ts`: suggestion bank (60+ phrases) grouped by category.
- All content is **data files** — easy for Claude to extend.

## 8. Quality Bar (what "best-looking possible without assets" means)

- Consistent outline + 4-tone ramps, soft shadows, small idle wobble on everything.
- Day/night grade with warm/cool contrast, window glow, light halos on fire/sun.
- Juicy feedback: squash & stretch on spawn, sparkle on change, shockwave rings on big commands, confetti on celebrations.
- Satisfying audio for every action.
- If visuals and time conflict: **polish the 5 most-seen things** (villagers, chickens, sun, village center, UI bar) before anything else.
