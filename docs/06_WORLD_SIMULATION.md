# 🌍 06_WORLD_SIMULATION

The simulation continues whether or not the player speaks. The player does not create life; the player **interrupts** life. Commands change parameters and entities; **systems** compute consequences; **events** connect everything.

## 1. System List

Time · Weather · Lighting(data) · Nature · Water · Fire · Wind · Gravity · Physics(z) · Population · Economy · Food · Happiness · Normalcy · Chaos · Building · Wildlife · Memory/Chronicle · Prayer · Gossip · Disaster · Newspaper(generator) · Snapshot(Undo)

Each system: `init(ctx)`, `update(dt)` or `onTick(tickName)`, subscribes to events, owns its data. **No system calls another directly.**

## 2. Scheduler (tick groups)

| Rate | Systems |
|------|---------|
| Every frame (variable dt) | camera, animation interpolation, particles, z-physics integration, rendering sync |
| 20 Hz (50 ms) | movement/steering, collisions, fire spread micro-steps |
| 5 Hz | weather transitions, wildlife roaming, utility AI re-eval slice |
| 1 Hz | needs, mood, gossip, prayers, normalcy/chaos decay, snapshots (every 2 s) |
| Game-minute | economy deltas, schedules |
| Game-hour | nature growth, population micro-updates |
| Game-day | births/deaths/migration, crop yield, construction progress |

Time scale: **1 real second = 1 game minute** by default (a game day ≈ 24 real minutes). Make "speed up time" go ×4/×16; "stop time" freezes sim clocks but **keeps rendering/particles/UI alive** (a frozen-time shader tint).

**AI slicing:** each frame update only `N/slices` NPC brains (round-robin) to avoid spikes.

## 3. Time & Lighting

Phases: Dawn (warm orange) → Morning → Noon (bright white) → Afternoon → Evening (golden) → Dusk → Night (deep blue). Light params interpolate smoothly: `ambientColor, ambientIntensity, sunDirection/shadowLength, skyGradient, starAlpha`. Sun/Moon entities orbit from `timeOfDay`. **Sun color edits** (`Celestial.color`) feed straight into the lighting grade — "green sun" tints the whole world green. Street lights/windows glow at night.

## 4. Weather

States: `clear, cloudy, rain, storm, snow, fog, windy, hail`; plus comedic **precipitation entities** (`pizza, frogs, ducks, money, confetti`) = rain of spawned falling entities.
Weather has `intensity 0–1` and transitions over 3–8 s. Natural drift every ~3–6 game hours with Markov probabilities from config; player can override anytime.
Effects: movement speed, crop growth, visibility (fog overlay), mood, lighting, animal behavior, river level, **fire suppression**, lightning (storm: random strikes → fire chance on burnable).
Renderer reads `WeatherState`; sim emits `WeatherChanged`.

## 5. Nature

Trees: Growth stages (sapling → young → mature → old → dead/stump), fruit, leaf color seasonal/edited. Grass spreads on empty tiles slowly; burnt ground recovers over game days (ash → grass). Flowers bloom in rain. Cut trees yield wood (Economy). Forests heal themselves.

## 6. Water

River + lake as `Water` entities/tiles with `level`. Rain raises, drought lowers. **Flood command:** raise level, spread water tiles outward for N seconds; NPCs flee to high ground; buildings flooded take damage; then it recedes (leaving mud). Fish optional. Ducks/frogs prefer water.

## 7. Fire

Grid-based fuel simulation on **burnable entities + grass tiles**: each burning cell has `intensity`, spreads to neighbors with prob ∝ wind alignment × fuel × (1 − wetness). Rain/water reduce. Burnt → ash, entity damaged/destroyed, smoke particles. Villagers with Bravery extinguish (bucket chains, comedic); animals flee; smoke dims visibility slightly. Fire emits `FireStarted/FireSpread/FireExtinguished/ForestBurned`.
Cap: max 400 simultaneously burning cells; beyond that, fast-forward to ash visually.

## 8. Wind

`WindState {dir, speed}`; affects cloud drift, rain angle, smoke, leaves, fire spread, flyers, windmill rotation. Commands: "wind from the east", "calm", "hurricane".

## 9. Gravity & Z-Physics

Global `gravity` (default 1.0). Every physical entity integrates `z, vz` (see `04`). Commands: delete/disable (0), reverse (−1), low (0.2), high (3), "float". Systems that react: Animation (flail), AI (Float/Cling states, panic), Economy (items float away → market loss), Dialogue triggers ("I forgot my ladder"). **Ceiling:** `Z_MAX` where entities gently bounce/drift; reverting gravity makes them fall with cartoon bounce + dust puffs + small damage-free "oof" sound.

## 10. Population & Food & Economy (a small, legible model)

Village resources: `food, wood, stone, money, prosperity`, prices per resource.
Producers: farmers → food, builders/woodcutters → wood, merchants → money/trade. Consumers: every villager consumes food daily.
Chains the player will *see*:
- Burn forest → wildlife flees (↓ animal count near) → wood supply ↓ → wood price ↑ → construction slows → villagers complain → happiness ↓.
- Spawn 500 chickens → food ↑ (eggs) → egg price ↓ → merchants unhappy → farm space shortage → complaints → chickens everywhere → crowd gathering.
- Delete gravity → items float → market sales ↓ → mood ↓ → prayer "please put the ground back".
- Give everyone money → inflation (prices ↑) next day.
Population: births when food & prosperity are high, immigration when prosperity ≫, emigration when happiness is low or food short (villagers walk off-map with a bindle).

## 11. Happiness, Normalcy, Chaos

- **Happiness (per NPC & global):** weighted needs + mood + recent miracles; global displayed as %.
- **Normalcy (0–100):** starts 85. Each miracle subtracts `magnitude × novelty × k`; recovers `+r/sec` toward 85 as villagers habituate. Repeated *same-kind* miracles drop novelty (diminishing). Thresholds change behaviors (panic ≤ 30, resigned ≥ 70 after high chaos).
- **Chaos (0–10):** exponential moving sum of recent magnitudes, decays ×0.97/s. Drives music, shake, sky tint, newspaper trigger (≥ 6 or single magnitude ≥ 8).

## 12. Building

States: `planned → construction → complete → damaged → destroyed → repaired`. Builders consume wood/stone over time; **"build a castle"** shortcut spawns a construction site with a fast **time-lapse build animation** (rising layered sprite + dust + hammer sounds) completing in ~5 s (comedic "builders worked overtime"). Buildings affect NPC homes/jobs; destroyed homes → homeless NPCs seek tents.

## 13. Wildlife

Animals seek food/water/shelter/safety; forest loss reduces wild bird/fox counts; rain boosts vegetation. Predators optional, non-gory (a fox "chases" a chicken, chicken runs, no kills).

## 14. Memory System & The Chronicle

Event stream → **Incident detector**: groups events of the same `kind` within 20 s into an **Incident** with `{kind, count, magnitude, location, startedAt}`. On close, **names** it via templates:

```
spawn {n≥50, kind}      → "The Great {Kind} Incident"
gravity off/reverse     → "The {Weekday} Gravity Disappeared" / "The Floating Tuesday"
sun color {c}           → "The {C} Sun"
fire large              → "The Great Fire"
flood                   → "The Soggy Tuesday"
dragon                  → "The Dragon Administrative Event"
time stop               → "The Long Moment"
improv generic          → "The {Word} Misunderstanding"
```

Chronicle entry: `{id, name, summary, inWorldDate, magnitude, relatedIds}`. NPCs and newspapers can cite entries. In-world calendar: "Tuesday, Year N" where each player session day increments (comedy: weekday label is always Tuesday).

## 15. Prayers & Gossip

- **Prayers:** needs-based (rain when drought, fire help, food shortage) + absurd pool. Max 3 active; expire after ~2 min; granting detected by event predicates (e.g., `RainStarted` fulfills "send rain"). Reward: Faith ↑, sparkle, Chronicle line, newspaper "Prayers Answered" snippet.
- **Gossip:** NPCs within 3 tiles exchange a "rumor" (a miracle perception) with 30% distortion (counts ×1.5, adjectives swapped). Spreads panic/celebration with contagion factor.

## 16. Disasters (cartoon-safe)

Entities with `Disaster` component driven by small state machines: `tornado` (wanders, lifts entities → z up + spin, drops them later, no harm), `meteor` (falling shadow → crater decal + dust + fire chance), `earthquake` (camera shake + building wobble + crack decals, minor integrity loss), `lightning`, `flood`, `fire`, `frog-plague` (spawns frogs). Villagers: panic → run to tavern/high ground → dust off → complain.

## 17. Snapshot / Undo System

- Every 2 s (and **before each command**), capture a **delta snapshot**: only entities/globals whose dirty flag changed since last capture (structural sharing of typed arrays; store compressed).
- Ring buffer 90 s (≈ 45 snapshots + per-command anchors).
- `undo` restores the pre-command anchor; `rewind N` finds the nearest ≤ now−N; `redo` re-applies the stored forward command.
- Restore replaces entities in place (pooled), reinitializes indexes, emits `WorldRestored`.
- Must remain **< 5 ms** at 1,000 entities (profile!).

## 18. Events (immutable facts)

Naming: past tense, noun-first: `EntitiesSpawned, EntityDestroyed, PropertyChanged{entityIds, property, old, new}, WeatherChanged, TimeScaleChanged, GravityChanged, FireStarted, FireExtinguished, ForestBurned, FloodStarted, IncidentOpened/Closed, ChronicleEntryAdded, PrayerPosted/Granted, MoodChanged, NormalcyChanged, ChaosChanged, CommandExecuted, CommandImprovised, NewspaperReady, WorldRestored`.
EventBus: typed, synchronous dispatch with a **deferred queue** for events emitted during update; no payload mutation.

## 19. Determinism

All randomness via **seeded PRNG** (`mulberry32`) with named streams (`world`, `ai`, `weather`, `names`, `improv`, `cosmetic`). Visual-only randomness uses `cosmetic` so replays stay identical. Simulation steps use fixed dt (50 ms) accumulator.

## 20. Performance Budgets (1,000 entities, mid laptop)

| Item | Budget |
|------|--------|
| Sim total | ≤ 4 ms/frame |
| AI | ≤ 2 ms |
| Fire | ≤ 1 ms |
| Render CPU | ≤ 3 ms, **draw calls ≤ 60** |
| Snapshot | ≤ 5 ms (rare) |
| Heap churn | ~0 allocations per frame in hot loops |

## 21. Golden Simulation Rule

The player changes the world; the simulation **explains the consequences**. Every command must trigger at least: **one visual effect, one sound, one NPC reaction, one log/chronicle line.**
