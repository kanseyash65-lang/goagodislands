# PROGRESS — Average Tuesday

## Status

| Milestone | Status | Notes |
|---|---|---|
| M0 Scaffold & single-file proof | ✅ | Vite 8 + TS 7 strict + Three r186 + singlefile; `verify` guard |
| M1 Procedural world on screen | ✅ (lean) | Atlas + tint mask, baked terrain, instanced layers, y-sort, shadows, camera, debug overlay |
| M2 Entities, time & living NPCs | ✅ (lean) | SoA entities, property registry, world gen, day/night grade, utility-lite AI, z-gravity, dialogue |
| M3 Voice command engine & core effects | ✅ | Parser + Improv + chaining + pronouns, 16 effects, impact cam, runes, Thing labels |
| Bubble cap fix | ✅ | ≤4 when zoomed out, nearest to latest event, 220 ms fade, overlap stacking |
| The Daily Tuesday (from M6) | ✅ | Magnitude > 7 or "show the newspaper"; PNG download, copy caption |
| Spawn juice (from M7) | ✅ | Squash & stretch, shock rings, sparkles; peak 0.125 ms/frame |
| Perf pass | ✅ | 2000 chickens + rain: ~0.25 ms CPU/frame, 6 draw calls; interleaved instance buffers |
| M4–M8 (rest) | ⏳ | |

## Decisions
- `exactOptionalPropertyTypes` is off (allowed by 09 §3); everything else strict incl. `noUncheckedIndexedAccess`.
- M0–M2 were built in one pass as the foundation for M3 (no prior code existed).
- Speech bubbles are HTML overlay (07 §3); sun/moon are screen-anchored sprites in the sky layer.
- WASD panning is not bound: the command bar keeps keyboard focus for Wispr Flow. Arrow keys pan only while the bar is empty.
- Spatial grid deferred to M4 (fire spread needs it); M3 target queries are linear scans that run once per command, never per frame.
- Meta features from later milestones (undo, spells, mute…) answer politely in-universe rather than failing.

## Known issues
- Adding a *new* Thing label re-uploads the full 1024² atlas + mask: a one-off ~10 ms frame (seen in both c034f82 and b9d08be). Fix: a separate small label texture.
- Thing label slots are LRU (32). A very old label can be reused by a new word.
- Disasters are cartoon one-shots. The fire/flood simulation is M4.

## Next
- M4: fire/flood/wind simulation, economy chain reactions, chronicle incident naming.
