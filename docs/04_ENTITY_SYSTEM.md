# 🧩 04_ENTITY_SYSTEM

Everything in the world is an **Entity**: sun, villager, tree, chicken, cloud, river, house, mountain, even the weather. Entities hold **data (components)**; **systems** hold logic; the **renderer** only reads.

## 1. Core Rules

1. Every object is an entity. No special-case singletons (sun and moon are entities with `Celestial`).
2. Components are **plain data** (no methods).
3. Systems query by **component set** or **tag** via indexes.
4. Every **editable property** is registered in the **Property Registry** so voice commands can modify things generically.
5. Prefer composition; no inheritance trees.
6. Reference other entities by **ID**, never by object pointer or display name.

## 2. Entity Shape (TypeScript sketch — Claude implements, don't paste verbatim)

```ts
type EntityId = number;                 // dense integers for speed (not UUID strings)
interface Entity {
  id: EntityId;
  kind: string;                         // 'villager' | 'chicken' | 'tree' | 'sun' ...
  name: string;                         // "Martha", "Chicken #212"
  tags: Set<string>;                    // 'living','animal','burnable','flying','villager'...
  enabled: boolean;
  createdAt: number;
  components: Record<string, unknown>;  // typed via component registry
}
```

For performance with thousands of entities, use **struct-of-arrays (SoA) typed arrays** for hot components (Transform, Velocity, RenderTint) and Maps for the rest. Provide an `EntityManager` with: `create(kind, overrides)`, `destroy(id)`, `get(id)`, `query(...components)`, `byTag(tag)`, `spatial.queryRadius(x,y,r)`.

## 3. 2.5D Altitude (this is how "2D" supports gravity commands)

World is 2D `(x, y)` but every physical entity also has **`z` (altitude)** and `vz`.
- Renderer draws sprite at `(x, y + z * Z_SCALE)` with a **separate shadow** at `(x, y)` that shrinks/fades as `z` grows.
- Gravity system integrates `vz += g * dt`, floors at ground height. **Reverse gravity** → `g` negative → entities rise, sprites scale up slightly, shadows shrink, things pile at a "ceiling" (z max) then drift. **No gravity** → `g = 0`, leftover velocities make things drift & rotate slowly.
- This gives the *"I forgot my ladder"* gag for free and keeps all rendering 2D.

## 4. Standard Components (data only)

| Component | Fields |
|-----------|--------|
| `Transform` | x, y, z, rot, scale, layer |
| `Velocity` | vx, vy, vz, angVel |
| `Render` | spriteKey, frame, tint(rgb), opacity, glow, flipX, depthBias, visible, animState, animTime |
| `Physics` | mass, gravityScale, drag, bounciness, solid, radius |
| `Health` | hp, maxHp, regen, invincible |
| `Needs` | hunger, energy, thirst, social, safety, comfort, purpose, fun |
| `Mood` | mood, intensity, since |
| `Personality` | bravery, kindness, greed, curiosity, patience, humor, confidence, laziness, faith, optimism |
| `Brain` | state, goal, targetId, nextThinkAt, utilityCache |
| `Memory` | ring buffer of {title, t, emotion, importance, related[]} |
| `Relations` | home, village, family[], friends[], enemies[], owner |
| `Job` | type, workplace, schedule key, income |
| `Inventory` | capacity, items, money |
| `Burnable` | fuel, burning, burnRate, ignitionResist |
| `Growth` | stage, age, growthRate, fruit |
| `Building` | kind, owner, capacity, progress, materialsNeeded, occupants, integrity |
| `Celestial` | color, brightness, radius, temperature, orbit params (sun/moon/stars) |
| `Water` | depth, flow, kind (river/lake) |
| `Flyer` | flapRate, altitudeTarget |
| `Dialogue` | currentLine, expiresAt, cooldownUntil |
| `Speech` (alias) | — (use `Dialogue`) |
| `Disaster` | kind, intensity, ttl (for tornado/meteor entities) |
| `Tagged` | — handled by `tags` |

Add components freely; register each in `entities/components/registry.ts` with defaults + serialization.

## 5. Property Registry (the key to "hundreds of commands")

Each editable property is described as data:

```ts
registerProperty({
  name: 'color', aliases: ['colour','tint','shade'],
  appliesTo: ['render'],            // components required
  valueType: 'color',
  get: e => e.render.tint, set: (e,v) => e.render.tint = v,
  emits: 'ColorChanged',
});
```

Properties to ship: `color, size, speed, health, mood, wealth, opacity, rotation, altitude, brightness, temperature, radius, glow, job, fear, hunger, energy, happiness, gravityScale, fuel, visible`.
Special-case **global properties** (world-level): `gravity, timeScale, windSpeed, windDir, weather, timeOfDay, rainIntensity`.

Command executor sets properties **only** via the registry → new entity types need zero command changes.

## 6. Tags (fast grouping)

`living, human, villager, farmer, child, animal, bird, flying, livestock, plant, tree, burnable, edible, water, building, wooden, stone, celestial, hostile, friendly, magical, structure, natural`.
Examples: "burn every burnable", "make every flying animal blue", "heal all living".

## 7. Kinds & Definitions (data, not classes)

`entities/definitions/*.ts` export plain objects: default components, tags, sprite keys, spawn rules.

Ship at least: villager variants (farmer, builder, merchant, guard, child, elder), chicken, cow, sheep, dog, cat, bird, duck, frog, dragon, fish (optional), tree (oak, pine, fruit), bush, flower, grass tuft, rock, house, farm, windmill, market, well, tavern, castle, bridge, statue, tent, fence, sun, moon, cloud, mountain, river, lake, meteor, tornado, firepit, pizza (rain-pizza comedic prop), confetti/object placeholder `thing` (Improv).

## 8. Lifecycle

`create → init → register(index) → active → update(by systems) → [paused] → destroy → cleanup (release pool slot, remove from indexes, emit EntityDestroyed)`.
Use **free-lists** to recycle IDs/instance slots (no per-frame allocation).

## 9. Spatial Index

Uniform grid hash (cell = 4 tiles). Updated only when an entity crosses cells. Supports `queryRadius`, `queryRect`, `nearest(tag)`. Required for AI perception, fire spread, "near the river" resolution, culling.

## 10. Serialization

All entities serialize to JSON: `{id, kind, tags, components}`. Snapshot = world meta + entities + chronicle + global params. Versioned (`saveVersion`). Used for **Undo/Rewind**, **localStorage save**, and **seed replay validation**.

## 11. Entity Design Rules (checklist)

- Can this be an entity with editable properties? → yes → do it.
- Does a new command require new code? → the registry should have made it unnecessary.
- No logic in components. No renderer reads from AI state except through `Render`/`Transform`.
