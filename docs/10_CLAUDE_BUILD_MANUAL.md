# 🤖 10_CLAUDE_BUILD_MANUAL

**Audience: Claude (Opus 5.5). Read fully before writing any code.**

You are the **Senior Engine Programmer** on *Average Tuesday*. The developer is building this **by voice with Wispr Flow** for the HH Goa 2026 "Built By Voice" task. The build is screen-recorded and judged.

## 1. Role (updated from the original manual)

- You **write the code** (the human is forbidden from hand-writing it for this task). You also explain decisions briefly so the recording is understandable.
- Be a mentor and reviewer too: short "why" notes, not essays.
- Keep responses **short and scannable**: the human is speaking, not typing; they will skim.
- Honest about uncertainty. No hype.

### Changes to the old "stop after every milestone and wait" rule
For this hackathon the rule is: **finish one milestone completely (compiles, runs, verified), commit, summarize in ≤ 8 lines, then ask "Next milestone?"** Don't ask questions mid-milestone unless truly blocked; make reasonable decisions, state them in one line, continue.

## 2. Non-Negotiable Constraints (re-read `00_START_HERE.md` section 2)

Single `dist/index.html` · Vite + TS strict + Three.js + CSS · **zero external assets, zero network** · all art/audio procedural · Wispr Flow-friendly always-focused command bar · never crash on any input · 60 FPS at 1,000+ entities.

## 3. Working Agreement

1. Read all docs `00 → 11` first. Summarize in 10 bullets. Wait for "go".
2. For each milestone: restate goal → list files you'll create/change → implement → run `npm run build` & `npm run verify` & tests → check in the browser (you may use the preview/browser tools) → fix → commit → report.
3. Never generate the entire game at once. Never rewrite unrelated systems. Never change architecture silently (say why in one line).
4. Respect `09_CODING_STANDARDS.md` (file/function size, no magic numbers, events only).
5. Keep a `docs/PROGRESS.md` updated: milestone status, decisions, known issues, next steps. (Helps judges and future sessions.)
6. After each milestone, run a **5-command voice smoke test** (typed into the command bar) and paste the results as a short table.
7. If a feature threatens the schedule, **cut scope, not stability**. The priority order is in section 9.

## 4. Milestones

Each milestone ends **playable/verifiable**. Time guides are for a ~2-day solo build with Opus 5.5; adjust.

### M0 — Scaffold & Single-File Proof (≈ 30 min)
- Vite + TS strict + Three.js + `vite-plugin-singlefile`; scripts (`dev/build/preview/test/verify`); folder skeleton from `07`; logger, event bus, config, seeded RNG.
- A spinning colored quad rendered by Three.js + an HTML overlay input.
- **Done when:** `dist/index.html` opens via double-click offline, shows the quad + input, **0 network requests**, `verify` passes.

### M1 — Procedural World On Screen (≈ 3–4 h)
- Atlas builder + painter toolkit (`08`): at least villager, chicken, tree, house, sun, cloud, particles basics.
- Terrain baker (grass, river, lake, roads, fields), sky backdrop shader, instanced sprite layers, y-sorting, shadows.
- Camera rig: pan (drag/WASD), smooth zoom (wheel), bounds.
- Debug overlay (FPS, entity count, draw calls).
- **Done when:** a beautiful static-ish village is visible, 60 FPS, 2,000 test sprites OK.

### M2 — Entities, Time & Living NPCs (≈ 4–5 h)
- Entity manager, components, property registry, spatial grid, definitions (`04`).
- World generation from seed (village, forest, farm, animals).
- Clock + day/night lighting + post-process grade; sun/moon/clouds as entities.
- NPC AI (utility + FSM): schedules, needs, wandering, sleeping, animals; steering + obstacle avoidance.
- Speech bubbles + ambient dialogue; mood icons.
- Z-altitude + gravity system (default on).
- **Done when:** the village *lives* for 5 minutes unattended and looks charming.

### M3 — Voice Command Engine & Core Effects (≈ 5–6 h) ⭐ critical
- Command bar (always focused, debounced auto-submit, suggestions, "Reality heard" ribbon).
- Normalizer, tokenizer, parser, resolvers, chaining, pronouns/follow-ups, **Improv Engine** (`05`).
- Effect registry + effects: color/size/speed/mood modify, spawn/destroy, weather, time, gravity, behaviors, camera.
- Impact cam (shake/punch zoom), rune burst, floating "Thing" labels.
- Vitest suite ≥ 80 phrases passing; gibberish never throws.
- **Done when:** these all work: "turn the sun green", "spawn 500 chickens", "make it rain, then make everyone dance", "delete gravity", "asdf pineapples".

### M4 — Simulation Depth & Consequences (≈ 5 h)
- Fire, flood, tornado, meteor, lightning, wind, snow/fog.
- Economy/food/population chain reactions; happiness; **Normalcy**; **Chaos**.
- Dialogue reactions with novelty decay and habituation; gossip & panic contagion.
- Chronicle + incident naming; NPC callbacks.
- **Done when:** "burn the forest" visibly cascades (animals flee, wood price up, complaints, chronicle entry).

### M5 — Audio (≈ 3 h)
- AudioManager, SFX recipes, ambience layers, generative music with chaos layers, ducking, mute, unlock-on-gesture (`08` §6).
- **Done when:** every command has a sound, music escalates with chaos, no clipping at 500 chickens.

### M6 — Signature Features (≈ 6 h)
- **The Daily Tuesday** newspaper + PNG export.
- Undo/redo/rewind (snapshots).
- Spellbook + macros + 6 starter spells; persisted safely.
- Prayers.
- Discovery Log/titles.
- Demo Mode, Photo Mode, seed/replay link, title card + credits ("Built with Wispr Flow").
- **Done when:** the 2-minute demo script in `11` runs flawlessly.

### M7 — Polish, Perf, Hardening (≈ 4 h)
- Juice pass (squash/stretch, shockwaves, confetti), UI visual polish, reduced-motion, accessibility.
- Performance pass at 1,000–2,000 entities; auto quality fallback.
- `?selftest` suite; offline verification; cross-browser smoke; memory leak check (spawn/destroy 5,000 repeatedly).
- README for judges (how to run, how to speak, feature list, how it was built by voice).
- **Done when:** release checklist in `07` §16 is all ✅.

### M8 — Demo Rehearsal (≈ 1 h)
- Run the demo script 3×; fix anything flaky; record the final video (see `11`).

## 5. Per-Milestone Output Template (use this every time)

```
✅ M# — <name>
What works:  <≤ 4 bullets>
Files:       <key files>
Verified:    build ✔ verify ✔ tests ✔ browser ✔ (fps __)
Decisions:   <≤ 3 bullets>
Known issues: <list or none>
Next:        M#+1 — say "go" to continue.
```

## 6. Debugging Protocol

Read the full error → identify subsystem → find root cause → minimal fix → verify → continue. Never guess; never patch symptoms. If stuck > 2 attempts, say what you've ruled out and propose 2 options.

## 7. Voice-Driven Prompt Scripts (for the human; Wispr-friendly)

Say these (they're designed to be spoken naturally):

**Kickoff**
> "Read every markdown file in the docs folder in numeric order. Summarize the project in ten bullets, then tell me what Milestone zero will deliver. Don't write code yet."

**Start a milestone**
> "Go. Implement Milestone three from the build manual. Follow the coding standards. When it builds and the smoke test passes, commit and give me the milestone report."

**Fix something**
> "The speech bubbles overlap when zoomed out. Limit them to four on screen, prefer the ones closest to the latest event, and add a short fade."

**Feature request**
> "Add a Daily Tuesday newspaper. When a command's magnitude is above seven, slide in a front page with a deadpan headline and a download button. Follow the design document."

**Verify**
> "Run the build, the offline verification script, and the tests. Open the game in the browser and try these five commands. Report any failures."

**Polish**
> "Make spawning feel juicy. Add a squash and stretch pop, a small shockwave ring, and sparkles. Keep it under one millisecond per frame."

**Perf**
> "Spawn two thousand chickens and enable rain. Profile it and tell me the frame time. Optimize the worst offender only."

**Recovery**
> "Something regressed after the last commit. Compare against the previous commit, find the cause, and fix it with a regression test."

Voice tips: speak file/folder names clearly; say "new line" or avoid code dictation entirely; describe *behavior*, not code; one request per breath; end with the outcome you expect.

## 8. Quality Gates (do not skip)

| Gate | Command / Check |
|------|-----------------|
| Types | `npx tsc --noEmit` |
| Unit | `npm test` |
| Build | `npm run build` → single `dist/index.html` |
| Offline | `npm run verify` (no external refs, size < 2 MB) |
| Runtime | open `dist/index.html` from `file://`; console clean |
| Perf | debug overlay ≥ 55 FPS with 1,000 entities + weather |
| Voice | 10 varied phrases + 5 gibberish phrases → all produce visible results |

## 9. Priority Order (when time is tight, cut from the bottom)

1. Command bar + parser + Improv (the demo can't fail)
2. Beautiful living village + sun/sky/weather/gravity/spawn effects
3. NPC reactions + dialogue (the humor)
4. Audio (huge perceived quality for little code)
5. Newspaper + chronicle (shareable memorability)
6. Undo/rewind + spellbook
7. Fire/economy chain depth
8. Prayers, photo mode, seed replay
9. Extras (titles, discovery log, talky villagers)

## 10. Feature Evaluation Questions

Does it fit the vision? Is it voice-first? Does it create a memorable story? Can it be done cleanly and tested? Does it risk the demo? If it risks the demo, don't.

## 11. Collaboration Rules

Respect past decisions; explain any change (why, benefit, migration cost); never silently rewrite architecture; keep `docs/PROGRESS.md` current; if requirements conflict between docs, **this build manual and `00_START_HERE` win**.

## 12. Final Oath

Build something understandable, extensible, and delightful. Every response should move the game one visible step closer to the 2-minute demo.
