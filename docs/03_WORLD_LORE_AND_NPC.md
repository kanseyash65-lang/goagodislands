# 🌍 03_WORLD_LORE_AND_NPC

(Merges original `02_WORLD_LORE` + `06_NPC_AI`, expanded with dialogue banks Claude can use directly.)

## 1. The Universe

The world existed before the player. Villages, farms, birds, rivers, clouds, families. The player is not a creator; the player is **an interruption**. NPCs believe their world is entirely real and **never know the player exists** — they only experience *miracles*.

### The Invisible God
No body, no dialogue, no inventory. Spoken commands become reality instantly.

### Why "Average Tuesday"?
The universe constantly experiences impossible events and **everyone treats absurdity as normal.** It's always, somehow, Tuesday. The joke is quiet. People still go to work; farmers still farm; someone says *"I hope next Tuesday is quieter."*

### Laws of Reality (the player may rewrite them)
Gravity pulls. Time flows. Water falls. Fire spreads. Plants grow. Animals need food. Humans need shelter. Changing a law changes the simulation (see `06`).

### Golden Lore Rule
> "Would the people of this world continue living their lives after this happened?" If yes, it belongs.

## 2. Humor Rules (the most important page)

1. **Contrast:** impossible event + completely believable reaction.
2. **Deadpan.** Never exclamation spam. Never meme speak ("LOL", "XD", emojis in dialogue).
3. **Specificity beats randomness.** "I forgot my ladder." > "AHH!"
4. **Mundane priorities.** Villagers worry about taxes, laundry, parking, and the weather during apocalypses.
5. **Callbacks.** Reference Chronicle events later ("Not since the Green Sun").
6. **Escalating acceptance.** First reaction: shock. Fifth: shrug. Twentieth: complaint about *how* it happened.
7. **Rule of three** in newspapers and chains.

Good: *Player: delete gravity → Villager: "I forgot my ladder."*
Bad: *"OMG LOL gravity gone XD"*

## 3. NPC Philosophy

At any moment every NPC can answer: **Who am I? Where am I? What am I doing? Why? What do I need? What happened recently? What do I want next?**
NPCs never stand still without purpose; every movement answers "why?"

## 4. NPC Types

Human: Farmer, Builder, Merchant, Guard, Child, Elder, Visitor (rare).
Animals: Chicken, Cow, Sheep, Dog, Cat, Bird, Duck, Frog (from "rain frogs"), Dragon (spawnable, treated by villagers with *administrative* concern).

Each has procedurally generated: **name** (syllable generator, 2 lists), **color palette**, **personality**, **job**, **home** (a house entity ID), **favorite thing**, **pet peeve** (used in dialogue).

## 5. Brain Architecture (simplified for Three.js hackathon scope)

```
Perception → Needs/Mood → Decision (utility scores) → Action (state machine) → Result → Memory
```

- **Utility AI**: each candidate action gets a score = need pressure × personality weight × context (time, weather, hazards). Pick top (with small noise). Re-evaluate every 0.5–1 s, **not** every frame.
- **Action states** (human): `Idle, Walk, Work, Eat, Sleep, Socialize, Panic, Flee, Dance, Celebrate, Pray, Investigate, Extinguish, Float, Cling`.
- **Animal states:** `Wander, Eat, Sleep, Flee, Flock, Dance, Lay Egg, Float`.
- **Pathing:** steering toward targets with simple obstacle avoidance on a coarse grid (A* on 2-tile cells for key trips, steering for local). Avoid water (except bridge), fire, buildings. Crowds use separation.

## 6. Needs (0–1)

Hunger, Energy, Social, Safety, Comfort, Purpose, Fun, Health. Highest pressure wins, with **Emergency > Needs > Job > Social > Exploration > Idle**. Fire always overrides work. Hunger overrides chatting.

## 7. Personality (0–1 floats)

Bravery, Kindness, Greed, Curiosity, Patience, Humor, Confidence, Laziness, Faith, Optimism.
- Curious → investigates miracles. Brave → helps extinguish fires. Fearful → runs. Faithful → prays more. Lazy → naps during chaos.

## 8. Mood

`Happy, Neutral, Sad, Excited, Terrified, Angry, Inspired, Confused, Resigned`.
Resigned is the **end state of habituation** and the funniest one.
Mood changes animation (bob speed, arm wave), tint of a small mood icon above head, and dialogue pool.

## 9. Daily Schedule

| Time | Farmer | Merchant | Builder | Guard | Child | Elder |
|------|--------|----------|---------|-------|-------|-------|
| Morning | field | open market | build | patrol | play | sit on bench |
| Afternoon | field/feed | sell | build | patrol | play | chat |
| Evening | home | close | home | tavern | home | home |
| Night | sleep | sleep | sleep | night watch | sleep | sleep |

Schedules are **data tables** in config, not code.

## 10. Reactions To God (miracle pipeline)

When an event with `impact ≥ 1` fires, each NPC within perception (or hearing via gossip) gets a **Miracle Perception**: `{kind, magnitude, novelty}`.
Reaction = f(personality, current mood, novelty). **Novelty decays per kind** (second green sun → shrug). This is how "Normalcy" and "Resigned" emerge.

Stages: **Confusion → Discussion → Theory → Acceptance → Complaint.**

## 11. Group Behavior

- Panic spreads (contagion radius), crowds form around novelties (curious NPCs), rumors travel NPC→NPC and can be distorted ("I heard it was 600 chickens"), celebrations spread. People copy nearby behavior with probability.

## 12. Memory

Each NPC: ring buffer of 12 memories `{title, time, emotion, importance, relatedIds}`; importance decays unless reinforced. Global Chronicle (see `06`) provides named incidents NPCs can cite.

## 13. DIALOGUE BANKS (Claude: use these as seed data in `data/dialogue.ts`; generate more in the same voice)

Format: `trigger → lines[]` (pick by personality/mood; fill `{placeholders}`).

### Ambient (calm)
- "Lovely weather for the time of year."
- "Did you feed the chickens? I can't remember."
- "I've got a good feeling about this Tuesday."
- "Taxes are due. Somewhere."

### Sun / Sky color changed
- "I've never trusted green suns."
- "It was yellow yesterday. I'm almost sure."
- "Good for the crops. Probably."
- "The moon is blue now. We're not discussing it."

### Gravity deleted / floating
- "I forgot my ladder."
- "I preferred yesterday."
- "My hat left. Without me."
- "Has anyone seen the cow? Upward, I think."
- "Don't put the bread down. Bread is not secure."

### Gravity reversed
- "The sky is now the floor. I'm adjusting."
- "Look on the bright side. The ceiling is very big."

### Chickens spawned (high count)
- "We'll need a bigger farm."
- "That's more chickens than the village has opinions."
- "I counted forty and then lost the will."
- "Egg prices are going to be a *problem*."

### Fire / forest burned
- "Not again. We just rebuilt."
- "Someone fetch the bucket. The *other* bucket."
- "At least the squirrels are out of the property market."

### Rain / storm
- "It's raining. In Tuesday, that's unusual."
- "My crops are delighted. I am not."

### Dragon
- "I'm sure it's friendly. Please don't make eye contact."
- "Has anyone checked if it has a permit?"
- "It's eating the windmill. I'm getting my coat."

### Dance
- "I didn't plan to dance today but here we are."
- "My legs have made a decision."

### Time stopped / sped
- "Is it Tuesday? It feels like Tuesday."
- "Time is moving. Quickly. I did not consent."

### Newspaper / history callbacks
- "Not since the Great Chicken Incident."
- "Remember the Green Sun? Simpler times."

### Habituation / Resigned
- "Another miracle. Put it with the others."
- "Honestly, it's been a quiet week."
- "I hope next Tuesday is quieter."

### Prayers (absurd + sincere mix)
- "Please, just one normal day."
- "Send rain. The crops are sad."
- "Could someone move the mountain? It blocks my morning view."
- "I'd like a slightly smaller sun."
- "Give the chickens a union."

### Improv fallback reactions (unknown command)
- "Something happened. I'm choosing not to ask."
- "That felt like a Tuesday decision."
- "Reality is… complicated today."

**Dialogue system rules:** max 1 bubble per NPC per 6 s; bubble lifetime 3.5 s; global max 4 bubbles on screen when zoomed out (prefer ones near the event and highest-drama); never repeat the last 5 lines per NPC; reference a Chronicle event ~15% of the time once one exists.

## 14. Save Data Per NPC

Identity, position, needs, mood, personality, relationships, inventory, schedule, current action, last 12 memories, job, health, age.

## 15. Performance

Full AI only for NPCs within camera ± margin; distant ones update at 1 Hz with simplified logic; sleeping NPCs use statistical updates. Animals use simple FSM. Budget: **AI < 3 ms/frame** at 1,000 entities.

## 16. Future (design hooks only)

Families, marriage, festivals, religion, crime, tourism, legends — all just new components + systems.
