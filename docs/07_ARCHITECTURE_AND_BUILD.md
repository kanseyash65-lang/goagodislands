# 🏗️ 07_ARCHITECTURE_AND_BUILD

(Merges original 07 Parts 1–3 + Final. Adapted for **Three.js + Vite single-file + zero external assets**.)

## 1. Philosophy

Modularity · Scalability · Maintainability · Data-driven · Voice-first.
**Simulation creates reality. Renderer visualizes it. UI displays it. Commands change it through events.**

## 2. Project Setup (Claude: do this in Milestone 0)

```
average-tuesday/
├─ index.html              (Vite entry; minimal shell: canvas root + UI root)
├─ package.json
├─ tsconfig.json           (strict: true, noUncheckedIndexedAccess: true)
├─ vite.config.ts
├─ docs/                   (these markdown files)
└─ src/ ...                (see section 4)
```

**Dependencies (only these):** `three`, `vite`, `typescript`, `vite-plugin-singlefile`; dev-only: `vitest`, `@types/three`.
No React, no Phaser, no Howler, no CDN scripts, no fonts, no images.

### vite.config.ts (intent; Claude writes the exact file)

- plugins: `viteSingleFile()`
- `build.assetsInlineLimit = 100000000`, `cssCodeSplit = false`, `build.rollupOptions.output.inlineDynamicImports = true`
- `build.target = 'es2020'`, `minify = 'esbuild'` (or terser), `sourcemap = false`
- Result: `dist/index.html` containing everything. Verify: open via `file://`, DevTools → Network shows **0 external requests**.

### package.json scripts

`dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test` (vitest), `verify` (custom script: fail if `dist/index.html` contains `http://`/`https://` URLs except inside harmless string comments, or exceeds 2 MB).

### Mandatory "No External Asset" guard

A `scripts/verify-offline.mjs` greps `dist/index.html` for `src="http`, `href="http`, `url(http`, `fetch(`, `.png|.jpg|.mp3|.wav|.woff` references. Build fails if found.

## 3. Rendering Approach: "2D look, Three.js engine"

- **Camera:** `OrthographicCamera` looking straight down −Z; world units = pixels-ish (1 tile = 16 units). Pixel-crisp option: render at integer zoom + `NearestFilter`.
- **Renderer:** `WebGLRenderer({ antialias:false, powerPreference:'high-performance' })`, `setPixelRatio(min(devicePixelRatio, 2))`, handle resize + context loss.
- **Sprites = InstancedMesh quads** with a custom `ShaderMaterial`:
  - One shared **texture atlas** (`CanvasTexture`, see `08`), UV rect per instance.
  - Instance attributes: `offset (x, y+z, depth)`, `scale`, `rotation`, `uvRect (u0,v0,u1,v1)`, `tint (rgb)`, `opacity/glow`.
  - **Few draw calls**: group by *layer* (ground decals, plants, buildings, characters, shadows, particles, UI-in-world). Each layer = 1–3 instanced meshes (capacity pools: 4,096 sprites default, grow ×2).
  - Depth/sorting: **y-sort** for characters & plants via `depth = layerBase − y * eps`; avoid per-frame full sorts (update only for moved entities).
- **Shadows:** separate instanced blob-quads in a shadow layer (z-aware).
- **Terrain:** a **single baked `CanvasTexture`** (e.g., 1536×1024 px) painted at world gen (grass noise, dirt roads, river, lake, sand edges, flowers). Re-bake **dirty rects** when things change (burn → ash, flood mud). No per-tile meshes.
- **Sky/Backdrop:** full-screen quad with a gradient + stars shader (uniforms from lighting state). Sun/moon/clouds are entities rendered as sprites in a sky layer with parallax (screen-anchored).
- **Lighting/Grade:** a **post-process pass** (full-screen quad shader after scene render via `WebGLRenderTarget`): ambient color multiply, vignette, bloom-lite (cheap glow from emissive layer), color grading uniform (sun color influence), time-stop desaturate, rewind scanlines, glitch wobble (Reality Stability low). Keep it ONE extra pass.
- **Particles:** one instanced layer, pooled (rain, snow, smoke, fire embers, confetti, dust, sparkles, runes). Max 8,000 live; spawner rejects beyond budget.
- **In-world text** (speech bubbles, name tags, "Thing" labels): drawn into a **dynamic text atlas** (Canvas2D) with LRU cache → instanced quads; **or** HTML overlay elements for ≤ 4 bubbles. Prefer HTML overlay positioned via camera projection for bubbles (crisp, cheap at low counts), instanced quads for labels at scale.
- **Selection/hover:** CPU picking via spatial grid (no raycaster against thousands of meshes).
- **Culling:** CPU cull by camera rect against the spatial grid; write only visible instances (`mesh.count`). Update `instanceMatrix`/attribute buffers with `needsUpdate` + `updateRanges` when possible.
- Dirty flags: PositionChanged, TintChanged, FrameChanged, VisibilityChanged → per-layer partial buffer uploads.

## 4. Source Layout (kebab-case folders, ≤ 300 lines per file preferred)

```
src/
  main.ts                      boot → Game.start()
  core/
    game.ts                    wires everything (composition root)
    config/                    *.config.ts (all tunables)
    constants/
    events/                    event-bus.ts, event-types.ts
    time/                      clock.ts, scheduler.ts, game-calendar.ts
    rng/                       mulberry32.ts, streams.ts
    logger/
    services/                  (interfaces: IEventBus, IClock, IWorld, IAudio …)
  entities/
    entity-manager.ts
    components/                (data types + registry)
    definitions/               (kind definitions as data)
    factory/                   spawn helpers
    properties/                property-registry.ts + property defs
    spatial/                   grid-hash.ts
  systems/
    time/ weather/ nature/ water/ fire/ wind/ gravity/ physics-z/
    population/ economy/ happiness/ normalcy/ chaos/ building/
    wildlife/ ai/ memory/ prayer/ gossip/ disaster/ snapshot/
  commands/
    normalizer/ tokenizer/ parser/ resolver/ improv/ validators/
    executor/ effects/         (one file per effect family)
    data/                      verbs, nouns, colors, weather, patterns, spells
    context/                   command-context.ts (pronouns, follow-ups)
    __tests__/
  rendering/
    renderer.ts                three setup, resize, loop hook
    camera/                    camera-rig.ts (pan/zoom/shake/auto-frame)
    layers/                    sprite-layer.ts (instanced), particle-layer.ts
    terrain/                   terrain-baker.ts
    sky/ lighting/ post/       shaders as template strings (glsl in .ts)
    atlas/                     atlas-builder.ts
  assets/                      ← CODE ONLY: procedural generators (see 08)
    art/                       sprite painters (canvas2d), palette, noise
    audio/                     synth voices, sfx recipes, music generator
    fonts/                     bitmap/pixel-font painter (no font files)
  audio/
    audio-manager.ts           WebAudio graph, bus, ducking, mute, unlock
    music/                     generative music engine
    sfx/                       sfx triggers (event-driven)
  ui/
    command-bar/ topbar/ chronicle-panel/ prayers/ spellbook/ newspaper/
    toasts/ help/ debug/ title-card/ credits/
    styles/                    *.css (imported; inlined by vite)
  data/                        dialogue.ts, names.ts, headlines.ts, prayers.ts, tips.ts
  save/                        serializer.ts, storage.ts (try/catch localStorage)
  utils/                       math/ color/ noise/ pool/ typed-array helpers
  types/
```

## 5. Boot Sequence

```
index.html → main.ts
 → create root DOM + CSS
 → AudioManager (lazy; unlock on first user gesture)
 → AtlasBuilder.generate()            (procedural art → CanvasTexture)   [loading bar, ≤ 1.5 s target]
 → Renderer/Layers/Post init
 → World generation (seed)            (terrain bake, entities spawn)
 → Systems register (ordered)
 → UI mount (command bar focused)
 → Title card (auto-dismiss on first key/voice/click or 4 s)
 → Main loop starts
```

Handle `webglcontextlost` (show friendly message + reinit) and "WebGL unavailable" (static message).
**Audio unlock:** browsers block audio until a gesture. Show "Click or say anything to begin" on the title card; first keypress/click/`input` event resumes `AudioContext`.

## 6. Main Loop

```
requestAnimationFrame:
  dt = clamp(now - last, 0, 100ms)
  input/UI poll (command queue drain, staggered)
  sim accumulator: while acc ≥ STEP(50ms): systems.step(STEP)   // fixed
  1 Hz / 5 Hz tick groups from Scheduler
  animation + interpolation (alpha = acc/STEP)
  camera update
  render sync (entities → instance buffers, dirty-only)
  renderer.render (scene → rt → post → screen)
  audio update (music/sfx params)
  ui update (throttled DOM writes)
```

**Renderer never mutates simulation.** UI only emits intents to the CommandManager or reads from the store.

## 7. Services & Dependency Injection

Composition root (`core/game.ts`) builds concrete implementations and passes **interfaces** to systems: `IEventBus, IClock, IRng, IEntityService, IWorldParams, IAudioService, IChronicle, ISpatial`.
Systems never import other systems; they import types + services. Allows `vitest` with mocks.

## 8. Dependency Rules

Allowed: UI → EventBus/CommandManager · Systems → EntityManager/Services/EventBus · Executor → Services/EventBus · Renderer → EntityManager (read) + EventBus.
Forbidden: Renderer → AI/Systems · UI → World logic · NPC → Renderer · Parser → Executor · Anything → hidden globals.

## 9. Audio Architecture (details in `08`)

`AudioManager` owns a single `AudioContext`, master gain → compressor, buses: `music, ambience, sfx, ui`. Event-driven: systems emit events, `SfxRouter` maps events → synth recipes. **Voice ducking:** when the user submits a command, duck music 3 dB for 400 ms. Polyphony caps per sfx to prevent clipping at 500-chicken moments (rate-limit + voice stealing).

## 10. UI Architecture

Plain TypeScript + DOM + CSS (no framework). Each panel is a small class with `mount(root)`, `update(state)`, `destroy()`. UI state read from a **read-only `UiStore`** populated by event subscriptions. Throttle DOM writes (≤ 10 Hz for stats, 60 Hz only for the command ring animation). CSS variables for theme; `prefers-reduced-motion` respected.

## 11. Save / Load / Replay

- Save package: `{version, seed, time, weather, globals, entities, chronicle, prayers, spells, stats, commandLog}`.
- `localStorage` wrapped in try/catch (can throw in `file://` or private mode). Fallback: in-memory + "Export JSON" download.
- Replay: URL hash `#s=<seed>&c=<base64 command log>` rebuilds the world and replays with staggered timing.
- Validate on load; malformed → ignore with a friendly toast.

## 12. Error Recovery & Logging

System `update` wrapped in try/catch → log, disable that system after 3 consecutive failures for 10 s, keep running. Levels: TRACE/DEBUG/INFO/WARN/ERROR with `{t, subsystem, msg, entityId?, commandId?}`. Production build strips TRACE/DEBUG. Debug overlay toggle (`~` or "debug"): FPS, frame ms, entity count, draw calls, active instances, events/s, queue length, per-system ms.

## 13. Performance Rules

60 FPS target; instancing; pooling; typed arrays; no per-frame allocations (reuse vectors/arrays); spatial grid; slice AI; cap particles; cap bubbles; throttle DOM; avoid `Array.prototype.filter/map` in hot loops; atlas packed once; textures never modified in play (except dynamic text atlas and terrain dirty-rects).
**Target machine:** typical laptop with integrated GPU. **Fallback:** if average FPS < 40 for 3 s → auto-reduce particle cap, post-process quality, instance caps; show nothing to the user.

## 14. Testing

- `vitest` unit tests: normalizer, parser, resolver, improv, property registry, RNG determinism, serializer round-trip, snapshot restore.
- Integration: spawn → command → event → state.
- Manual smoke checklist (see `10` and `11`).
- Add a hidden `?selftest` URL param that runs a **self-test command suite** (e.g., 40 phrases) in-browser and prints PASS/FAIL to the debug overlay — useful in the recording to prove reliability.

## 15. Security

Treat all text input as hostile: length cap (500 chars), strip control chars, never `eval`/`new Function`, escape any text injected into DOM (use `textContent`), validate save data shape.

## 16. Release Checklist

- `dist/index.html` is a single file, **works via double-click offline**.
- 0 external requests; no console errors; no unhandled promise rejections.
- 60 FPS with 500 chickens + rain + fire.
- 20+ varied commands (incl. gibberish) all produce results.
- Undo/redo/rewind work; spellbook saves; newspaper exports PNG.
- Audio unlock works; mute works; reduced-motion works.
- Chrome + Edge + Firefox tested (Safari best-effort).
- Wispr Flow dictation lands in the command bar and auto-submits.

## 17. Anti-Patterns

God classes · circular imports · hidden globals · magic numbers · 1000-line files · deep inheritance · renderer-owned gameplay · UI-owned simulation · parser-owned execution · per-entity Three.js `Mesh`/`Sprite` objects (use instancing!) · loading anything over the network.

## 18. Engineering Oath

If a feature can't be explained simply, it's too complex. If a system depends on everything, redesign it. If a new command requires rewriting old code, the architecture failed.
