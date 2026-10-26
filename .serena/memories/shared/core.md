# packages/shared

- Rules and the round simulation for both apps; everything is exported from `src/index.ts` (TypeScript source, no build).
- Runs in the browser and in a Worker: no DOM, no Node (`tsconfig` has `types: []`).
- `RULES_VERSION`: bump when a change would make an existing round replay differently. The server records it per round.
- Determinism (the server replays rounds; `docs/architecture.md`): fixed tick, taps applied at tick boundaries; logical coordinates = the frame size captured at round start; one full-precision seeded RNG stream with a fixed draw order; game decisions use only `+ − × ÷`, comparisons and exact `Math` helpers (`floor`, `round`, `min`, `max`, `abs`) — no `Math.sin/cos/pow/hypot/sqrt/random`, no `Date`/`performance`.
- Rules come from `docs/design/gameplay.md` and the kit's `CURVE`/`BONUSES`/`comboFor`/`pointsFor`/`pickBonus` in `apps/game/src/kit/bundle.js`: port them; never import the kit here.
