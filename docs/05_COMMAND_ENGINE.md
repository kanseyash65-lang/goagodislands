# 🗣️ 05_COMMAND_ENGINE

The Command Engine turns **messy dictated speech** into **structured commands**. It knows language, never world rules. The simulation decides consequences. **No network, no LLM API, no external files**: everything is local grammar + fuzzy matching + data tables.

## 1. Design Goals

1. **Never reject.** Every sentence produces *something* (the Improv Engine, section 9).
2. Tolerate **Wispr Flow output**: auto-punctuation, capitalization, filler words, self-corrections, trailing periods, numbers as words.
3. Data-driven: new verbs, nouns, colors, effects are **table entries**, not code branches.
4. Parsing never executes; executing never parses.
5. Deterministic and replayable (command log + seed).
6. Fast: parse < 2 ms.

## 2. How Wispr Flow Actually Delivers Text (design around this)

Wispr Flow dictates into whatever text field has focus. It does **not** give us an API or events, only typed text. Therefore:

- The command `<input>` must be **always focused** (re-focus on blur, click, window focus, after submit).
- Text may arrive **all at once** or in bursts, possibly with a trailing period or newline.
- Use **debounced auto-submit** (default 900 ms after the last `input` event, only if the text is non-empty) *and* Enter to submit instantly.
- Strip trailing punctuation, collapse whitespace, ignore a leading "um/uh/okay/hey/please/can you/could you/I want you to/let's".
- Support **self-corrections**: "make it rain no wait make it snow" → keep the text after the last `no wait|actually|I mean|scratch that`.
- Support **multi-command bursts** in one dictation (see chaining).
- Never lose a command: if the engine is busy, **queue** it.
- Show the heard text in a "Reality heard:" ribbon with a quick parse preview (verb · target · value) so players trust it.

## 3. Pipeline

```
Transcript
 → Cleaner/Normalizer      (lowercase, fillers, spelling variants, number words → digits, units)
 → Splitter                (chain split: "and then", "then", ",", "and also", "after that")
 → Tokenizer               (tokens with kind hints)
 → Intent Resolver         (verb table + patterns + fuzzy)
 → Target Resolver         (noun table, groups, names, pronouns, modifiers)
 → Property/Value Resolver (property registry, colors, sizes, enums, numbers, durations)
 → Quantity/Modifier Res.  (every/all/random/near/except/only/within)
 → Validator               (typed, never throws)
 → Command[]               (structured objects)
 → [fallback] Improv Engine if confidence < threshold
 → Command Queue → Executor → Events
```

## 4. Normalizer (must-do list)

- lowercase; unify quotes; `colour→color`, `grey→gray`.
- number words → digits: `fifty→50`, `a hundred→100`, `a thousand→1000`, `five hundred→500`, `a couple→2`, `a few→3`, `several→6`, `a bunch/lots/many→25`, `a ton/a million→1000 (cap)`, `dozen→12`.
- units: `seconds, minutes, hours, days`.
- common mis-hearings (data table): `chicken(s)↔kitchen`? (don't; fuzzy handles), `sun↔son`, `gravity↔gravity`, `villagers↔village errs`, `duck↔dock`, `moon↔mood`. Keep a **homophone map** for domain words only.
- strip: `please, kindly, just, hey, okay, ok, so, like, um, uh, you know, god, universe, reality, Tuesday` (address words: "Reality, make it rain").
- map slang: `nuke→explode`, `yeet→launch`, `delete/remove/erase/vanish/get rid of/disappear/banish→destroy`.

## 5. Intent System (verbs → intents)

| Intent | Example verbs / phrases |
|--------|-------------------------|
| `spawn` | spawn, summon, add, create, make (+quantity+noun), give birth, drop, rain (+noun), conjure, "let there be" |
| `destroy` | delete, remove, destroy, erase, vanish, banish, kill (→ comic "vanish"), eliminate, get rid of, clear |
| `modify` | make, turn, change, set, color, paint, "make it X", "turn X into Y" |
| `scale` | grow, shrink, enlarge, inflate, make bigger/smaller/giant/tiny/huge/massive |
| `move` | move, push, send, teleport, pull, throw, launch, "put X near Y" |
| `heal` | heal, cure, revive, restore |
| `harm` | hurt, poison, curse, zap (comic, non-gory) |
| `give` | give, grant, bless, "give everyone X" (money, muscles, wings, hats) |
| `build` | build, construct, erect, raise, "make a castle" |
| `weather` | rain, storm, snow, fog, windy, sunny, clear, drought, flood, hail, meteor shower |
| `time` | make it night/day/noon/dawn, speed up, slow down, stop/freeze/pause time, resume |
| `physics` | gravity off/on/reverse/low/high, delete gravity, float |
| `behavior` | dance, panic, sleep, work, pray, celebrate, run, fight (comic), sing, "make them X" |
| `disaster` | burn, ignite, flood, earthquake, tornado, lightning, meteor, tsunami(comic), plague(of frogs) |
| `camera` | zoom in/out, follow, show, focus, bird's eye, photo mode |
| `meta` | undo, redo, rewind, remember as, cast, spellbook, newspaper, chronicle, help, demo, mute, reset, save, load |
| `improv` | fallback |

Resolution order: **meta → exact phrase patterns → verb table → fuzzy verb → improv.**

## 6. Target Resolution

Targets are resolved from a **noun table** (entity kinds + tags + groups + aliases + plural forms):

- **Kinds:** chicken(s)/hen/rooster, cow, sheep, dog, cat, bird, duck, frog, dragon, tree, bush, flower, rock, house, farm, windmill, market, well, tavern, castle, bridge, statue, sun, moon, cloud(s), mountain(s), river, lake, star(s), fence…
- **Groups:** villagers/people/humans/everyone/everybody/folks, animals/creatures/livestock, buildings, plants/nature/forest, "everything"/"the world", "farmers", "children/kids", "flying things".
- **Named:** any generated villager name (fuzzy-matched), e.g. "Martha".
- **Pronouns:** it/them/that/those → last target set (TTL 30 s).
- **Spatial phrases:** "near the river", "in the village", "by the windmill", "on the mountain", "in the forest", "in the middle", "everywhere", "above the farm" → resolve to anchor entity/region + radius.
- **Modifiers:** every/all/each, only, except/but, random/some, nearest/closest, half of, "the first N", "within N tiles".
- Plural/singular, "a/an/the" ignored. Fuzzy (Damerau-Levenshtein ≤ 2 for words ≥ 5 chars, ≤ 1 for 4) against noun table.
- Ambiguity: pick the **most plausible** (most numerous / closest to camera) and say so in the log ("Assuming you meant the village tree"). Don't block with a question.

## 7. Property & Value Resolution

**Colors:** a palette table with ≥ 40 named colors + modifiers (`dark/light/neon/pastel`), plus special values `rainbow` (animated hue cycle), `invisible` (opacity 0), `golden`, `glowing`, `plaid`(comic → pattern hint), `random`.
**Sizes:** tiny 0.4, small 0.7, big 1.5, giant 2.5, huge 3.5, massive 5, "twice as big" ×2, "half size" ×0.5, "N times bigger".
**Numbers:** digits or words; percentages ("at 50 percent").
**Booleans:** on/off, enable/disable, yes/no.
**Moods:** happy, sad, angry, scared, excited, confused, inspired, sleepy.
**Speeds:** fast/faster/slow/slower/"super fast", ×N.
**Durations:** "for ten seconds", "until morning", "for a minute".
**Directions:** north/south/east/west/up/down/left/right.
Property resolution uses the **Property Registry** (`04`): property exists on target? If not, look for an alias or an applicable fallback (e.g., "make cows happy" → `mood`). If still invalid → Improv.

**Implicit property inference:** "turn the sun green" → value `green` is a color ⇒ property=`color`. "make everyone giant" → `size`. "make them happy" → `mood`. "make the chickens fast" → `speed`.

## 8. Command Object

```ts
interface Command {
  id: number; source: 'voice' | 'text' | 'macro' | 'demo' | 'replay';
  raw: string; normalized: string;
  intent: Intent;
  target: TargetSpec;      // kind/tag/group/name/pronoun/anchor/modifiers
  property?: string; value?: Value;
  quantity?: number | 'many';
  where?: WhereSpec;       // anchor, radius, region
  duration?: number;       // seconds (temporary effects revert)
  confidence: number;      // 0..1
  magnitude: number;       // 0..10 estimated impact (drives camera, music, newspaper)
  chainIndex: number; chainLength: number;
  timestamp: number;
}
```

`magnitude` is computed in the parser (quantity, scope "everyone/everything", intent class). Used for Impact Cam, newspaper trigger, God Power cost, and chaos.

## 9. THE IMPROV ENGINE (our secret weapon)

Triggered when confidence < ~0.35 or required slots can't be filled. It **always** creates a visible, funny result and a log line:

1. **Keyword salvage:** find any known noun/color/verb/weather word in the sentence; combine into the nearest valid command ("make the sun a pineapple" → sun color yellow + spawns a pineapple prop near the sun? → at least recolor + "pineapple" prop).
2. **Unknown noun → Generic Thing:** spawn N copies of a **procedural "Thing"** sprite (a colored glow-orb with a doodled shape, label above it = the player's word, e.g., "pineapple") that villagers treat as that thing. Quantity from the sentence, default 5. ("spawn 20 pineapples" works even though we have no pineapple art!) Label font drawn on a Canvas texture.
3. **Unknown verb with known target:** apply a **random comic effect** from a pool: float, spin, bounce, glow, swap colors, grow/shrink, sprout hat, dance, vanish-and-return — and log "Reality interpreted that as *{effect}*."
4. **Pure nonsense:** trigger a **Tuesday Event**: a mild random weather/time/animal event with deadpan newspaper headline ("Local Reality Misunderstands Request").
5. **Always** emit `ImprovTriggered` so NPCs react ("That felt like a Tuesday decision.").
6. Log a *sanitized* hint of what worked ("Try: *spawn 20 ducks*") in the suggestions area — gentle teaching without failure messages.

Rule: no red error states for the player. Real failures (bugs) go to the debug console only.

## 10. Chaining

Split on: `and then`, `then`, `after that`, `afterwards`, `next`, `, and`, `;`, ` and ` **only when** the right side starts with a known verb (to avoid splitting "salt and pepper"). Execute sequentially with **200–600 ms staggering** (so each lands visibly), pushing to the queue. Magnitudes sum (capped).
"Make it rain, then spawn 20 ducks and turn the sun green" → 3 commands.

## 11. Follow-ups, Pronouns, Repeats

`CommandContext` keeps: last target set, last property, last value, last spawn position (TTL 30 s).
- "make **it** bigger" / "now make **them** blue" / "do **that again**" / "**more**" (repeat with ×2 quantity) / "**again**" / "**the other way**" (inverse: reverse gravity/color complement).

## 12. Meta Commands

- `undo`, `redo`, `rewind N seconds`.
- `remember this as X` / `save this as spell X` → macro from last 1–5 commands (default: last chain).
- `cast X` / `X` (if name matches a macro) / `spellbook`.
- `newspaper|front page|headlines`, `chronicle|history`, `prayers`, `help|what can I say`, `demo`, `mute|unmute|volume`, `reset world|new world`, `photo mode`, `save|load`, `slow motion`, `reduce motion`.
- `skip the intro`.

## 13. Validation & Feedback

- Validation is **typed and total**; returns `{ok, command}` or `{improv}`; never throws.
- Feedback ribbon format: `Reality heard: "turn the sun green"  →  modify · sun · color=green`.
- Low-confidence-but-plausible: execute and say "Assuming you meant…".
- Provide **echo/typewriter** of the effect result in the Chronicle: "The sun is now green."

## 14. Synonym & Pattern Tables (starter content Claude must ship as data)

Put in `commands/data/*.ts` (verbs, nouns, colors, weather, effects, patterns). Patterns use a tiny DSL, e.g.:

```
"turn|make|paint|color|change {target} {color}"            → modify color
"make {target} {size|mood|speed|property}"                  → modify inferred
"spawn|summon|add|create|drop {quantity?} {kind} {where?}"  → spawn
"delete|remove|destroy {target}"                            → destroy
"{weather}"  /  "make it {weather}"  /  "start {weather}"   → weather
"make it {time-of-day}"                                      → time
"{gravity-phrase}"                                           → physics
"make {group} {behavior}"  /  "everyone {behavior}"        → behavior
"build {quantity?} {building} {where?}"                      → build
"rain {noun}"                                                 → spawn from sky (comedy)
```

**Minimum shipped vocabulary:** ≥ 60 nouns, ≥ 40 colors, ≥ 80 verb phrases, ≥ 25 behaviors/effects, ≥ 12 weather/disasters, ≥ 15 sample "spells".

## 15. Executor & Events

Executor receives only `Command`. It calls **Effect handlers** from an **Effect Registry**:

```ts
registerEffect('spawn', { run(cmd, world, bus) { ... } });
```

Each effect: mutates via services (EntityService, WorldParams), emits events (`SunColorChanged`, `EntitiesSpawned`, `GravityChanged`...), returns a `ResultSummary` for the log/newspaper. **Temporary effects** (duration) schedule a revert via the Scheduler.

## 16. Testing (required)

Ship `commands/__tests__` run with `vitest` (dev only; excluded from the build) covering ≥ 80 phrases:
- Variants: "turn the sun green / make the sun green / change the sun to green / color the sun green / sun green" → same Command.
- Numbers: "spawn fifty chickens", "a hundred ducks", "two dozen cows".
- Chains, pronouns, fillers, self-corrections, homophones.
- Garbage: "asdf qwerty", "", "🙂", extremely long input → must produce Improv, never throw.
- Performance: 1000 parses < 1 s.

## 17. Golden Rule

The Command Engine never knows how the world works. It understands language and produces structured commands. The simulation explains the consequences.
