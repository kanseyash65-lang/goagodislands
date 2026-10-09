# 🎮 02_GAME_DESIGN

## 1. Overview

2D top-down sandbox. No quests, levels, enemies, or win state. Curiosity is the engine. The player is an invisible god; the world is already alive.

## 2. Core Loop

Observe → Imagine → **Speak** → World changes → Villagers react (dialogue + behavior) → Chain reactions → Chronicle/newspaper records it → Repeat.

Loop length target: **a command every 5–15 seconds**, each with a satisfying audiovisual payoff within **300 ms**.

## 3. Player Role

Invisible god: no body, no health, no inventory. Only: **voice**, **camera pan/zoom**, **click to select/inspect** (optional), **God Powers meter** (see 8).

## 4. The World (initial state)

- **Map:** ~96×64 tile world (tile = 16 world units), procedurally generated from a seed.
- **Terrain:** grass with variation, a winding river with a bridge, a small lake, a hill/mountain ridge at the top, dirt roads connecting buildings, a forest patch, a farm field.
- **Village:** ~8 houses, a market, a windmill, a well, a farm with fenced field, a small tavern (nice for dialogue).
- **Population on start:** 14 villagers (farmers, builders, merchants, guard, child, elder), 10 chickens, 4 cows, 6 sheep, 2 dogs, 1 cat, birds, ~120 trees, flowers, bushes.
- **Sky layer:** sun, moon, clouds, stars (drawn in screen-space backdrop + light grading).
- Everything is an Entity (see `04`).

## 5. Camera

Orthographic, top-down. Smooth pan (drag / WASD / arrows), smooth zoom (wheel / pinch / "zoom in", "zoom out", "show everything" by voice). Auto-framing on commands ("Impact Cam"): subtle punch-zoom + screen shake scaled by command magnitude, then ease back. **Camera never fights the user:** if the user drags, auto-cam pauses for 4 s.

Voice camera commands: "zoom in on the church", "follow John", "show me the chickens", "bird's eye view".

## 6. UI (all HTML/CSS overlay, no images)

```
┌────────────────────────────────────────────────────────────┐
│ ☀ 10:42 Tue · ⛅ Clear · 👥 14 · 😊 71%  · NORMALCY ▓▓▓▓░  │  Top bar
├───────────────────────────────────────────────┬────────────┤
│                                               │ CHRONICLE  │
│                  GAME CANVAS                  │ (event log)│
│        (speech bubbles float in world)        │ STATS      │
│                                               │ PRAYERS    │
├───────────────────────────────────────────────┴────────────┤
│  🎙 [ say something to reality…                 ] ⏎ 〰〰〰  │  Command bar (ALWAYS focused)
│  recent: turn the sun green · spawn 50 chickens · …        │
└────────────────────────────────────────────────────────────┘
```

Rules:
- Command input **auto-focuses on load and after every click/blur**, so Wispr Flow always lands text there.
- **Auto-submit** after the transcript stops changing for ~900 ms (configurable) *or* on Enter. A faint countdown ring shows it. Escape clears.
- Ghost-text **suggestions** under the bar (rotate 3 random "try saying…" ideas). Click a suggestion to run it.
- **Voice rune burst:** on submit, glowing runes spiral from the bar into the world.
- Icons are drawn with CSS/Canvas/Unicode — no images.
- Toasts for errors are friendly and in-universe ("Reality did not understand. Reality is trying its best.").
- Fully usable on a laptop at 1280×720 and in a recording at 1080p.

## 7. Signature Features (detailed)

### 7.1 The Daily Tuesday (newspaper)
After any command with **impact ≥ threshold** (or on "show the newspaper"), a front page slides in:
- Masthead "THE DAILY TUESDAY", procedural date ("Tuesday, again").
- Headline generated from the latest big event + a deadpan twist: *"LOCAL SUN TURNS GREEN; RESIDENTS 'MILDLY CONCERNED'."*
- Sub-stories from Chronicle, a fake weather box, a classified ad ("WANTED: ladder. Gravity-related."), a procedural "photo" (small canvas snapshot of the world around the event, sepia-filtered).
- Buttons: **Download PNG**, **Copy caption**, **Close**. (Great for X posts.)
- Voice: "show the newspaper", "front page".

### 7.2 Normalcy Meter
0–100%. Villagers' belief that "today is a normal day." Drops with miracles, regenerates as they *adapt* (habituation). Low normalcy → more panic, prayers, rumors; high normalcy after chaos → hilarious denial dialogue ("Nothing unusual. Just 400 chickens."). Displays as a calm bar that visibly twitches when hit.

### 7.3 Chaos Level (hidden → visible)
Internal 0–10 value from recent command magnitude. Drives music intensity, camera shake, sky tint, event log tone. Decays slowly.

### 7.4 Chronicle & Named Events
`MemorySystem` clusters related events into **named incidents** via templates ("The Great {Thing} Incident", "The Week {Thing} Disappeared", "The {Color} Sun"). Chronicle panel lists them with in-world dates ("Tuesday, Year 1"). Villagers reference them in dialogue.

### 7.5 Prayers (soft goals)
Every ~60–90 s a villager (based on needs/mood) posts a prayer: *"Please, send rain. The crops are sad."* Panel lists 1–3 active prayers. Granting by voice ("grant the prayer", or just doing it) gives a **Faith** bump + sparkle. Ignoring them is fine; some prayers are absurd ("Could someone move the mountain? It blocks my morning view.").

### 7.6 God Power (soft limiter, optional)
A regenerating "Reality Stability" meter. Huge commands (500 chickens, delete gravity) cost more; at 0 the world *glitches* (visual shader wobble) for a few seconds — comedic, never blocking. Default: **generous**, so it never frustrates.

### 7.7 Spellbook
- "Remember this as *Apocalypse*" → saves the **last N commands** (default last 3, or chained sentence) as a macro.
- "Cast Apocalypse" / "Apocalypse" → replays.
- Spellbook panel (toggle) lists macros; persisted in `localStorage` (guarded).
- Ships with **6 starter spells** (e.g., *Chicken Rain*, *Golden Hour*, *Green Tuesday*, *Zero-G Festival*, *Disco Dusk*, *Calm Down*).

### 7.8 Undo / Rewind
World snapshots every 2 s (ring buffer 60 s, delta-compressed or entity-field-diffed). "Undo that" restores the pre-command snapshot; "rewind 10 seconds" scrubs back; "redo" supported. Rewind plays a reverse-time visual (desaturate + scanline shader).

### 7.9 Follow-ups & Pronouns
"Make **it** bigger." "Do **that again**." "Now make **them** blue." The command context remembers the last target set for ~30 s.

### 7.10 Demo Mode (insurance)
"demo" or a hidden button runs a timed script (typewriter-types commands into the bar, same code path as voice). Perfect for judges without mics.

### 7.11 Seed Share
URL hash `#seed=XYZ&cmds=…` re-generates the same world and replays the command list. "Copy replay link" button.

### 7.12 Photo Mode
"photo mode" hides UI, slow-orbits zoom, exports PNG with a "Average Tuesday" stamp.

## 8. Progression (without levels)

Soft unlocks keep discovery alive:
- **Discovery Log** ("Reality Codex"): commands/effects you've triggered check off categories (Weather ✔, Physics ✔, Animals ✖…). Shows % discovered. Hints appear for undiscovered categories.
- **Titles** (cosmetic, funny): "Mildly Divine", "Chicken Baron", "Gravity Skeptic", "Tuesday Terrorist".
- **Session Summary** on exit/idle: stats + best headline.

## 9. Command Categories (MVP coverage — at least these must work)

| Category | Examples |
|----------|----------|
| Sky/Color | sun green · sky purple · make the moon blue · rainbow sky |
| Time | make it night · noon · speed up time · stop time · it's Friday (easter egg) |
| Weather | rain · storm · snow · fog · wind · sunny · meteor shower · "rain pizza/frogs" |
| Spawn | spawn 500 chickens · add 10 cows · a dragon · 20 ducks near the river · a castle |
| Destroy | delete all chickens · remove the trees · destroy the windmill · delete the mountain |
| Modify | make everyone giant · tiny cows · make the chickens blue · speed up villagers |
| Emotion/Behavior | make everyone dance · everyone panic · everyone sleep · make them happy · celebrate |
| Physics | delete gravity · reverse gravity · low gravity · heavy gravity |
| Disasters | burn the forest · flood the village · earthquake · tornado · lightning · meteor |
| Build | build a castle · a bridge · 5 houses · a statue of a chicken |
| Economy | give everyone money · double the wood · make food free · inflation |
| Heal/Harm | heal everyone · poison the sheep (comic) · give muscles |
| Camera | zoom in · follow John · show the church |
| Meta | undo · redo · rewind · remember as · cast · newspaper · photo mode · demo · help |

(See `05_COMMAND_ENGINE.md` for the full vocabulary table Claude must implement.)

## 10. Design Rules

Every feature must: be understandable in 5 s, work by voice, show a visible consequence, create a memory, and be funny through contrast. If it needs a tutorial, cut it.

## 11. First-Minute Experience (onboarding without a tutorial)

1. Title card draws itself (procedural logo), world already alive behind it.
2. "🎙 Say anything. Try: *turn the sun green*." (one line, auto-dismiss on first command.)
3. First command always gets a **bonus-strong reaction** (guaranteed dialogue + newspaper teaser).
4. After 20 s idle, a villager prays for something, nudging play.
5. After 3 commands, reveal suggestions and the Spellbook hint.

## 12. Accessibility & Safety

- Text-input fallback, reduced-motion toggle (disables shake/glitch), colorblind-friendly status icons, scalable UI, mute button.
- Content: slapstick only; no gore, no real-world tragedies. Disasters are cartoonish (villagers dust off and complain).
