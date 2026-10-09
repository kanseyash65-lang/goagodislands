# Upgrade plan: Goa God Islands (3D island strategy + voice god mode)

Checkpoint before migration: git tag `v1-2d-prototype` (the working 2D build).

## Audit (what exists)
- Vite 8 + TS strict + Three r186, single offline `dist/index.html`, all assets procedural.
- Voice: Wispr Flow types into an always-focused `<input>` (no API). `CommandBar` debounces → `CommandSubmitted` → `CommandManager` → `parseTranscript` (normalizer, chain splitter, slots, intent resolver, Improv) → `Executor` + effect registry → events.
- Simulation: SoA `EntityManager`, kind registry, property registry, brain/movement/z-physics/weather/dialogue/normalcy systems, chronicle, newspaper.
- Rendering: 2D instanced sprite atlas (to be replaced). Windmill bug: blades were anchored at their bottom edge, so they orbited instead of spinning on the hub.

## Migration path (safest practical)
Keep the engine core (events, entities, systems, command engine, UI shell, build/verify/tests) and swap the
presentation layer for a real 3D renderer in the same Three.js dependency. Entity ground coords (x, y) map to
3D (x, height(x, y) + z, y). Everything stays procedural: low-poly models built from geometry in code,
one instanced mesh per kind, shared shader with tint masks, limb swing and palm sway.

## Phases
1. Audit + checkpoint (done).
2. 3D island: terrain heightmap, transparent turquoise ocean with foam, sky dome, day/night sun, shadows,
   Goan village (Portuguese houses, chapel, shacks, lighthouse, fort, boats, jetty, palms), floating god avatar,
   Boom Beach-style HUD. Chickens removed.
3. Combat: troops (rifleman, heavy, rocketeer, medic, engineer), landing craft, gunboat abilities
   (artillery, flare, medkit, shield), defenses (cannon, machine gun, mortar, sniper tower, mines, bunker),
   projectiles, destruction, HQ victory, timer/army defeat.
4. Home economy: gold/timber/stone/metal, producers, storage, build mode (place, move, rotate, upgrade,
   remove), army setup, save/load, archipelago map with fog of war.
5. Campaign: 7 missions with objectives, rewards, unlocks, replay.
6. Voice god mode: world, construction, combat and mission commands; confirmation for destructive actions,
   clarification when ambiguous, visible success/failure feedback.
7. Audio, polish, performance, full-loop testing.
