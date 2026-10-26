# Code conventions

- ESM TypeScript everywhere. `import type` for type-only imports (lint: `consistent-type-imports`); unused params prefixed `_`.
- Prettier: single quotes, print width 100, trailing commas. Markdown and `docs/` are hand-formatted (excluded from Prettier).
- Comments are short and say why or what constraint applies; a file-top comment states the module's job. Match the existing density.
- Plain functions + interfaces; small modules. No UI framework: UI components are the kit's `(props) => HTMLElement` functions.
- Boundaries:
  - `packages/shared`: no DOM, no Node; deterministic (rules in `mem:shared/core`).
  - `apps/game/src`: browser code only; Node-only code lives in `apps/game/scripts/` (own `tsconfig.node.json`).
  - The UI kit is imported only through `apps/game/src/ui/kit.ts`; Facebook only through `apps/game/src/platform/` (the `Platform` interface).
  - Never edit `apps/game/src/kit/*` (vendored). `tokens.css` there is generated.
- Tests are colocated `*.test.ts`, named as behaviour sentences. Keep decisions pure and inject their inputs so they're testable in Node (e.g. `choosePlatform({ hasSdk, embedded, forced })`).
- Player-facing copy comes from the copy deck in `docs/design/states.md`: sentence case, no exclamation marks except "Go!", errors never blame or show codes, the network never blocks play.
- Commits: conventional prefix with scope (`feat(game)`, `feat(server)`, `feat(shared)`, `chore`, `ci`, `docs`, `test`); the body explains why; end with the agent's `Co-Authored-By` trailer.
