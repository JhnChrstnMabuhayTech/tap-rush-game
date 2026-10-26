# packages/shared

Rules and the round simulation for both apps; everything is exported from `src/index.ts` (TypeScript source, no build). Runs in the browser and in a Worker: no DOM, no Node (`tsconfig` `types: []`).

## Files
- `rules.ts` — port of the kit's rules: `pace`, `difficulty(elapsedSeconds, 30, score)`, `comboFor`, `pointsFor`, `pickBonus(random, frostsCaught)`, tables `CURVE`, `PHASES`, `BONUSES`. Numbers must equal the kit's (`apps/game/scripts/kit-rules.test.ts` enforces it).
- `random.ts` — `createRandom(seed)` mulberry32; `isSeed` (unsigned 32-bit). Never change the sequence: a test pins the first draws and stored rounds replay from it.
- `curves.ts` — `wave(turns)` (sine within 0.1%, drift) and `shrink(life)` (life^0.7 sampled at 17 points, visible radius).
- `simulation.ts` — `Round` (live) and `replayRound(config, taps)` (server). `RoundConfig = { seed, field: { width, height, top } }` in logical units (frame CSS px at round start; `top` = HUD band + safe-area inset). `replayRound` returns `{ score, caught, topCombo, ticks, lateTaps, catches }`; `catches` is `CatchTiming[]` (`kind`, `spawnTick` = ticks completed when the firefly appeared, `tick` = when caught; frozen ticks count) for the server's plausibility checks. `Firefly.ageMs` stops during a freeze, so it is not a reaction time.
- `api.ts` — request/response types the game and server share (type-only export): `StartRoundRequest/Response`, `SubmitScoreRequest` (`signature`, `taps`, claimed `score`), `SubmitScoreResponse` (`status` ranked|unranked, server `score` or null, `best`, `rank` or null), `ApiError`/`ApiErrorCode`.

## How a round runs
- `TICK_MS = 10`; `round.step()` advances one tick, takes no time argument, returns events (`spawn`, `catch`, `fade`, `streak-lost`, `phase`, `end`). The client steps however many ticks real time allows per frame.
- `round.tap(x, y)` applies between ticks, logs `{ tick: ticksCompleted, x, y }`, returns the catch or null; after the end it returns null and logs nothing. `replayRound` applies taps with `tick === n` before stepping tick n; out-of-order taps throw `RangeError`; taps after the end are counted as `lateTaps`.
- A round is 3000 ticks + 300 per caught Frost (max 2) → `MAX_ROUND_TICKS` 3600. `round.state` exposes score, caught, streak, `streakLeftMs`, `topCombo`, `frozenMs`, `phaseIndex`, current `difficulty`, live `fireflies` (oldest first; caught ones leave immediately).
- Deliberate departures from the kit's loop and their reasons: decision D13 in `docs/decisions.md`.

## Determinism (lint-enforced in `src/**`, tests exempt)
- Banned: `Math.sin/cos/tan/…/exp/log*/pow/cbrt/hypot/random`, the `**` operator, `Date`, `performance`, `crypto`. Allowed: `+ − × ÷`, comparisons, `%`, and exact helpers (`floor`, `round`, `min`, `max`, `abs`, `imul`, `sqrt` — though distances are compared squared).
- Any change that would make an existing round replay differently bumps `RULES_VERSION` (`src/index.ts`).
