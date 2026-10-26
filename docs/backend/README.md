# Backend: the leaderboard API

`apps/server` is a Cloudflare Worker that issues rounds, checks scores by replaying them, and keeps the leaderboard. It imports the same rules and round simulation as the game from `packages/shared`.

**See also:** [trust model](trust-model.md) for what the server checks and what it can't stop · [architecture](../architecture.md) for a round end to end · [frontend](../frontend/) for the game that calls it.

## Source map

```
apps/server/
  wrangler.jsonc     Worker config: name, entry point, compatibility date, bindings
  src/
    index.ts         The fetch handler and its routes
    index.test.ts    Tests that call the handler directly
```

## Endpoints (draft)

| Method and path | Purpose | Status |
| --- | --- | --- |
| `POST /v1/rounds` | Verify the player's signature, create a round, return `roundId`, `seed`, `rulesVersion`, `expiresAt`. | Planned |
| `POST /v1/rounds/{roundId}/score` | Verify, replay, store. Returns `status` (`ranked` or `unranked`), the server's `score`, the player's `best` and `rank`. | Planned |
| `GET /v1/leaderboard?player={id}` | Top 10 by best score, plus the player's own row and rank when they're outside it. | Planned |
| `GET /health` | Liveness check for uptime monitoring; also reports the `rulesVersion` it replays. | Built |

Every response that the player sees maps to a state in [design/states.md](../design/states.md). A rejected score is reported as `unranked`, never as an accusation.

## Data (draft)

- **players**: `id` (Facebook player ID), `name`, `photo_url`, `best_score`, `best_at`, `updated_at`
- **rounds**: `id`, `player_id`, `seed`, `rules_version`, `field_w`, `field_h`, `issued_at`, `submitted_at`, `score`, `status` (`issued` · `ranked` · `rejected`), `reject_reason`

The leaderboard is a query on `players` ordered by `best_score` descending, then `best_at` ascending, so on a tie the earlier score lists first. Tied scores get the same rank number.

## Hosting (proposed)

Cloudflare Workers with a D1 (SQLite) database. It's free at this scale, served over HTTPS, has no cold start and doesn't go to sleep, which matters because the backend has to stay up through the review. The Facebook App Secret is stored as a Worker secret and never reaches the client bundle or the repo. See [D7](../decisions.md#d7-host-the-backend-on-cloudflare-workers-with-d1).

## Running it

All commands run from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm --filter @glowcatch/server dev` | Local Worker on http://localhost:8787 (try `/health`) |
| `pnpm --filter @glowcatch/server build` | Bundle without deploying (`wrangler deploy --dry-run`), as CI does |
| `pnpm --filter @glowcatch/server deploy` | Deploy to Cloudflare; run `pnpm --filter @glowcatch/server exec wrangler login` once first |
