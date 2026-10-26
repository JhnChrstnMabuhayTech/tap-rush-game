# Glowcatch (repo `tap-rush-game`)

Exercise brief "Tap Rush" (Facebook Instant Game + leaderboard backend, 30 s round, shrinking circles, tap to score) rebuilt as **Glowcatch**: catching fireflies at dusk. pnpm monorepo, TypeScript throughout.

## Source map
- `apps/game/` — the Instant Game (Vite, Canvas + DOM, vendored Glowcatch UI kit). Boot, platform layer, kit rules, Facebook constraints: `mem:game/core`.
- `apps/server/` — leaderboard API on Cloudflare Workers (D1 planned). Routes, data model, secrets, trust checks: `mem:server/core`.
- `packages/shared/` — rules and deterministic round simulation, imported by both apps. Determinism rules and API: `mem:shared/core`.
- `docs/` — human docs, index `docs/README.md`: `frontend/` (game), `backend/` (server + `trust-model.md`), `design/` (snapshot of the design system: `gameplay.md` rules, `states.md` screens + copy deck, `tokens.json`), `architecture.md` (cross-cutting), `decisions.md` (D1…Dn, newest last, open questions table), `roadmap.md` (phases with checkboxes).
- `.github/workflows/ci.yml` — CI (install, lint, format check, typecheck, test, build).

## Invariants
- Game and server must compute the same score: every rule number lives in `packages/shared`; never re-declare rules in an app.
- Instant Games SDK 8.0 (Zero Permissions, decision D11): player names/photos never reach game code or the server; only Facebook overlay views can show them, from player IDs.
- Design source of truth is the user's Glowcatch design-system artifact on claude.ai; `docs/design/` is its snapshot and `apps/game/src/kit/` its vendored code. Take gameplay numbers and UI copy from there; record conflicts as review notes in `docs/design/README.md`.
- Docs move with code: module status tables in `docs/frontend/README.md` and `docs/backend/README.md`, roadmap checkboxes, a `decisions.md` entry for every non-obvious choice.
- Git: feature branch off `development` → PR into `development`; `main` is the reviewed state. One commit per logical unit. The Facebook build is only ever staged for Testing, never pushed to Production.

## Other memories
- Versions and why some are held back: `mem:tech_stack`
- Commands (dev, test, build, release) and Windows quirks: `mem:suggested_commands`
- Code style and patterns: `mem:conventions`
- What to run and update before calling work done: `mem:task_completion`
