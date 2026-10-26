# Backend: the leaderboard API

`apps/server` is a Cloudflare Worker that issues rounds, checks scores by replaying them, and keeps the leaderboard. It imports the same rules and round simulation as the game from `packages/shared`, and the request and response types from `packages/shared/src/api.ts`.

**See also:** [trust model](trust-model.md) for what the server checks and what it can't stop · [architecture](../architecture.md) for a round end to end · [frontend](../frontend/) for the game that calls it.

## Source map

```
apps/server/
  wrangler.jsonc     Worker config: name, entry point, compatibility date, the D1 binding
  migrations/        The D1 schema, applied in order (0001_init.sql: players, rounds)
  src/
    index.ts         The fetch handler and its routes
    env.ts           The bindings: DB, APP_SECRET, ALLOW_UNSIGNED
    player.ts        Who is playing: Facebook's signed player info, checked with the App Secret
    rounds.ts        POST /v1/rounds
    http.ts          JSON responses and request bodies
    *.test.ts        Tests, run inside the Workers runtime with a local D1
    test/            Test setup (an empty, migrated database per test) and a signer for player info
  vitest.config.ts   The Workers test runner (@cloudflare/vitest-plugin) and the test App Secret
```

## Endpoints

| Method and path | Purpose | Status |
| --- | --- | --- |
| `POST /v1/rounds` | Verify the player's signature, create a round, return `roundId`, `seed`, `rulesVersion`, `expiresAt`. | Built |
| `POST /v1/rounds/{roundId}/score` | Verify, replay, store. Returns `status` (`ranked` or `unranked`), the server's `score`, the player's `best` and `rank`. | Planned |
| `GET /v1/leaderboard?player={id}` | Top 10 by best score (player IDs, ranks, scores), plus the player's own row and rank when they're outside it. | Planned |
| `GET /health` | Liveness check for uptime monitoring; also reports the `rulesVersion` it replays. | Built |

Every response that the player sees maps to a state in [design/states.md](../design/states.md). A rejected score is reported as `unranked`, never as an accusation.

Errors are a status code and `{ "error": code }`: `bad_request` (400), `unauthorized` (401) or `not_found` (404).

### `POST /v1/rounds`

The game asks for a round while the 3-2-1 runs. The body is `{ signature, field }`:

- `signature`: from `FBInstant.player.getSignedPlayerInfoAsync()`, checked as the [trust model](trust-model.md#how-facebooks-signature-is-checked) describes. A bad or stale one gets `401 unauthorized`.
- `field`: the play frame the round is set up for, `{ width, height, top }` in CSS pixels. Width and height must be 100 to 4096 and `top` at most half the height; anything else gets `400 bad_request`.

The answer is `201` with `{ roundId, seed, rulesVersion, expiresAt }`. The server chooses the seed (32 random bits), and the score has to arrive within 15 minutes (`expiresAt`), which leaves room for pauses and a retry.

A player has at most one open round. Starting a new round closes the last one (`rejected`, reason `superseded`), so nobody can hold several seeds and play only the kindest. The game therefore sends a finished round's score before it asks for the next round.

## Data

The schema is [`apps/server/migrations/0001_init.sql`](../../apps/server/migrations/0001_init.sql). Times are milliseconds since the epoch.

- **players**: `id` (the game-scoped player ID from `FBInstant.player.getID()`), `best_score`, `best_at`, `updated_at`. A row is created with the player's first round, with `best_score` 0.
- **rounds**: `id`, `player_id`, `seed`, `rules_version`, `field_w`, `field_h`, `field_top`, `issued_at`, `expires_at`, `submitted_at`, `taps` (the tap log, kept as evidence), `score` (the server's replay, never the claimed score), `status` (`issued` · `ranked` · `rejected`), `reject_reason`

No names or photos: under SDK 8.0 the game can't read them and the server mustn't store them. The game turns player IDs into names and photos through an overlay view ([D11](../decisions.md#d11-instant-games-sdk-80-under-zero-permissions)).

The leaderboard is a query on `players` ordered by `best_score` descending, then `best_at` ascending, so on a tie the earlier score lists first. Tied scores get the same rank number.

## Hosting

Cloudflare Workers with a D1 (SQLite) database. It's free at this scale, served over HTTPS, has no cold start and doesn't go to sleep, which matters because the backend has to stay up through the review. The Facebook App Secret is stored as a Worker secret and never reaches the client bundle or the repo. See [D7](../decisions.md#d7-host-the-backend-on-cloudflare-workers-with-d1).

The Worker runs on its own `workers.dev` hostname. Cloudflare's bot challenges must stay off for it: the game calls it with `fetch`, which can't answer a challenge. Abuse is handled by the API's own checks and rate limits.

## Before it can serve the game

- The D1 database exists (`wrangler d1 create glowcatch`, its ID in `wrangler.jsonc`) and is migrated (`wrangler d1 migrations apply glowcatch --remote`).
- The Worker's domain must be on the Facebook app's Content Security Policy allowlist; an Instant Game can only call allowed domains, over HTTPS.
- `APP_SECRET`, the app's App Secret from the App Dashboard, is set with `wrangler secret put APP_SECRET` and never committed.

## Running it

All commands run from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm --filter @glowcatch/server exec wrangler d1 migrations apply glowcatch --local` | Creates or updates the local database (in `apps/server/.wrangler/`, gitignored). Run it once, and again after a new migration. |
| `pnpm --filter @glowcatch/server dev` | Local Worker on http://localhost:8787 (try `/health`) |
| `pnpm test` | Every test, the server's inside the Workers runtime with a fresh local D1 for each test |
| `pnpm --filter @glowcatch/server build` | Bundle without deploying (`wrangler deploy --dry-run`), as CI does |
| `pnpm --filter @glowcatch/server deploy` | Deploy to Cloudflare; run `pnpm --filter @glowcatch/server exec wrangler login` once first |

**Local secrets:** `wrangler dev` reads `apps/server/.dev.vars` (gitignored). Create it with:

```
APP_SECRET=local-dev-secret
ALLOW_UNSIGNED=true
```

`ALLOW_UNSIGNED` lets the game's local stand-in, which has no Facebook signature, start rounds. It works only on requests to `localhost`, and `wrangler deploy` never reads `.dev.vars` ([trust model](trust-model.md#local-development)).
