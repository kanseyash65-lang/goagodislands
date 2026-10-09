# 📘 09_CODING_STANDARDS

Mandatory for every line written by Claude or any human. Breaking a rule requires a one-line reason in a comment.

## 1. Priorities
Readability · Maintainability · Simplicity · Debuggability · Testability · Predictability · **Demo reliability**. Not cleverness.

## 2. Stack (fixed)
TypeScript (strict) · Three.js · Vite + `vite-plugin-singlefile` · plain CSS · WebAudio (no Howler) · npm. No React, no backend, no CDN, no extra runtime dependencies. Dev-only: vitest.

## 3. TypeScript
- `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` (if painful, drop only this one).
- No `any` (use `unknown` + narrowing). `readonly` where possible. Interfaces for shapes, `type` for unions.
- Enums → prefer string-literal unions + `as const` tables.
- No non-null assertions (`!`) except in tests.

## 4. Files, Functions, Naming
- Files: preferred 150–300 lines, warn > 400, hard max 600. Functions: ≤ 40 lines, one job.
- Folders **kebab-case**; files kebab-case (`event-bus.ts`); classes PascalCase; interfaces `IThing`; functions/vars camelCase; constants `UPPER_SNAKE`.
- One concept per file; barrel files (`index.ts`) only at folder level for public APIs.
- No folders named `misc`, `helpers`, `temp`, `stuff`.

## 5. Architecture Rules (enforced)
- Entities/components = data. Systems = logic. Renderer = read-only view. UI = display + intents.
- Systems talk via **EventBus** only. No system imports another system.
- Parser never executes; executor never parses.
- No hidden globals. Singletons only at the composition root.
- No circular imports (add `madge`-style check script if time permits).
- **No magic numbers**: tunables live in `core/config/*.config.ts`; visual constants in `rendering/constants`.

## 6. Performance Rules
- No allocation in hot loops (reuse temp vectors/arrays, typed arrays, pools).
- No per-entity Three.js objects; **instancing only**.
- Throttle DOM updates; batch buffer uploads; cap particles/bubbles.
- Measure before optimizing, **but** the 1,000-entity / 60 FPS budget is a requirement, so profile at each milestone with the debug overlay.

## 7. Errors, Logging, Safety
- Never crash on input. Never throw from parser/executor; return results.
- Wrap each system step; isolate failures; keep simulating.
- Logger with levels + subsystem tags; strip TRACE/DEBUG in production.
- Escape/`textContent` for all UI text; length-cap input; no `eval`.
- Any storage/audio/WebGL access: **try/catch + graceful fallback**.

## 8. Comments & Docs
- Comment **why**, not what. Public APIs get a short doc comment (purpose, inputs, outputs).
- Each system folder has a short `README.md` or top-of-file comment: responsibility, events in/out, config keys, known limits.

## 9. Testing
- vitest for normalizer/parser/resolver/improv/property registry/RNG/serializer/snapshot.
- Every bug fixed → add a regression test when feasible.
- Manual smoke checklist at each milestone (see `10`).
- `?selftest` in-browser command suite.

## 10. Git (the build is recorded; keep it clean)
- Small commits, conventional messages: `feat(commands): add quantity parser`, `fix(ai): …`, `chore(build): …`.
- Branches: `main` (stable), `feature/*`. Tag each milestone: `m1-world`, `m2-voice`, …
- Commit at the end of every milestone (it also shows progress in the screen recording).

## 11. Anti-Patterns (never)
God classes · giant switch statements for commands (use registries) · copy-paste systems · duplicated logic · deep inheritance · hardcoded gameplay numbers · network calls · external asset references · unbounded arrays/pools · silent failures.

## 12. Definition of Done (per feature)
Compiles (`tsc --noEmit`) · runs · no console errors · tested by hand · event-driven · configurable · documented in 3 lines · builds to the single file and still opens offline.

## 13. Oath
Readable beats clever. Architecture beats hacks. Consistency beats shortcuts. The demo must never break.
