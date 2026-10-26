# apps/server

- Cloudflare Worker: `wrangler.jsonc` (name `glowcatch-api`, main `src/index.ts`). `src/index.ts` default-exports `{ fetch }` `satisfies ExportedHandler<Env>` and routes on method + pathname with a small `json()` helper.
- Built: `GET /health` → `{ ok: true, rulesVersion }`; anything else → 404 `{ error: 'not_found' }`.
- Tests call `worker.fetch(new Request(url), env)` directly under Node. D1-backed tests are planned with `@cloudflare/vitest-pool-workers` (the reason Vitest is pinned to 4.1).
- Planned API and data: `docs/backend/README.md`. `POST /v1/rounds` (issue `roundId`, `seed`, `rulesVersion`), `POST /v1/rounds/{id}/score` (verify, replay with `@glowcatch/shared`, rank), `GET /v1/leaderboard`.
- Trust model (`docs/backend/trust-model.md`): Facebook signed player info verified with HMAC-SHA256 and `APP_SECRET`, constant-time compare, fresh `issued_at`, `request_payload` = roundId on submit; single-use server-issued rounds with expiry; server replays the tap log and ignores the claimed score; plausibility checks; rejected = `unranked`, never an accusation.
- Data: `players` holds the game-scoped player ID and scores only — never names or photos (SDK 8.0 policy, D11). `rounds` keeps seed, rules version, field size, tap-derived score, status and reject reason.
- Secrets: `APP_SECRET` via `wrangler secret put`; local values in `.dev.vars` (gitignored). Unsigned requests are accepted only behind a dev flag production never sets.
- Deploying needs a Cloudflare login; the Worker's domain must be on the Facebook app's CSP allowlist before the game can call it.
