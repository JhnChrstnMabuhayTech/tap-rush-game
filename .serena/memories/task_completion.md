# Before calling a task done

1. `pnpm check` is green (lint, Prettier check, typecheck, tests).
2. `pnpm build` too when deps, build config, entry points or the Worker changed (CI runs it).
3. Kit tokens changed → `pnpm --filter @glowcatch/game tokens`, and keep `apps/game/src/kit/tokens.json` identical to `docs/design/tokens.json` (tests enforce both).
4. Visible game change → run it and look at a phone size (390×844, touch) and a desktop size (letterboxed 9:16 frame).
5. Rules or simulation changed → bump `RULES_VERSION` in `packages/shared` if an existing round would replay differently.
6. Update docs in the same branch: status tables in `docs/frontend/README.md` / `docs/backend/README.md`, `docs/roadmap.md` checkboxes, a `docs/decisions.md` entry for any non-obvious choice, design review notes when the design system is contradicted.
7. New dependency: at least a day old (pnpm policy); a held-back major gets its reason in decision D12.
