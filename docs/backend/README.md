# Backend: the leaderboard API

`apps/server` is a Cloudflare Worker that issues rounds, checks scores by replaying them, and keeps the leaderboard. It imports the same rules and round simulation as the game from `packages/shared`, and the request and response types from `packages/shared/src/api.ts`.

**See also:** [trust model](trust-model.md) for what the server checks and what it can't stop · [architecture](../architecture.md) for a round end to end · [frontend](../frontend/) for the game that calls it.

## Source map

```
apps/server/
  wrangler.jsonc     Worker config: name, entry point, compatibility date, the D1 binding, the per-IP rate limit
  migrations/        The D1 schema, applied in order (0001_init.sql: players, rounds)
  src/
    index.ts         The fetch handler: CORS, the per-IP limit, the routes
    env.ts           The bindings: DB, LIMIT_BY_IP, APP_SECRET, ALLOW_UNSIGNED
    player.ts        Who is playing: Facebook's signed player info, checked with the App Secret
    rounds.ts        POST /v1/rounds
    score.ts         POST /v1/rounds/{roundId}/score: replay, judge, store, rank
    plausibility.ts  Human limits for a replayed round: reaction time, tap rate
    leaderboard.ts   GET /v1/leaderboard
    http.ts          JSON responses, request bodies, CORS headers
    *.test.ts        Tests, run inside the Workers runtime with a local D1
    test/            Test setup (an empty, migrated database per test), a signer for player
                     info, and a player that plays real rounds for the replay to check
  vitest.config.ts   The Workers test runner (@cloudflare/vitest-plugin) and the test App Secret
```

## Endpoints

| Method and path | Purpose | Status |
| --- | --- | --- |
| `POST /v1/rounds` | Verify the player's signature, create a round, return `roundId`, `seed`, `rulesVersion`, `expiresAt`. | Built |
| `POST /v1/rounds/{roundId}/score` | Verify, replay, store. Returns `status` (`ranked` or `unranked`), the server's `score`, the player's `best` and `rank`. | Built |
| `GET /v1/leaderboard?player={id}` | Top 10 by best score (player IDs, ranks, scores), plus the player's own row and rank. | Built |
| `GET /health` | Liveness check for uptime monitoring; also reports the `rulesVersion` it replays. | Built |

Every response that the player sees maps to a state in [design/states.md](../design/states.md). A rejected score is reported as `unranked`, never as an accusation.

Errors are a status code and `{ "error": code }`: `bad_request` (400), `unauthorized` (401), `not_found` (404) or `rate_limited` (429, with `Retry-After` in seconds).

### Calling it from the game

The game calls the API from Facebook's domain, so every answer, errors included, carries `Access-Control-Allow-Origin: *`, and `OPTIONS` answers the browser's preflight before a JSON `POST`. Any origin is allowed because the API trusts Facebook's signature on each request, not where the request comes from, and it uses no cookies ([D17](../decisions.md#d17-the-api-answers-calls-from-any-origin)).

### Rate limits

- **Per IP:** 300 requests a minute across `/v1` (Cloudflare's rate-limit binding `LIMIT_BY_IP`, counted per Cloudflare location). It's generous because players on one mobile network can share an IP; it's there to stop floods. `/health` isn't limited. Local runs and tests have no client IP and skip it.
- **Per player:** at most 20 rounds started in 5 minutes, counted in D1. A full round takes over 30 seconds, so more means a script, or quitting again and again to fish for an easy seed.

Either limit answers `429 rate_limited` with `Retry-After: 60`.

### `POST /v1/rounds`

The game asks for a round while the 3-2-1 runs. The body is `{ signature, field }`:

- `signature`: from `FBInstant.player.getSignedPlayerInfoAsync()`, checked as the [trust model](trust-model.md#how-facebooks-signature-is-checked) describes. A bad or stale one gets `401 unauthorized`.
- `field`: the play frame the round is set up for, `{ width, height, top }` in CSS pixels. Width and height must be 100 to 4096 and `top` at most half the height; anything else gets `400 bad_request`.

The answer is `201` with `{ roundId, seed, rulesVersion, expiresAt }`. The server chooses the seed (32 random bits), and the score has to arrive within 15 minutes (`expiresAt`), which leaves room for pauses and a retry.

A player has at most one open round. Starting a new round closes the last one (`rejected`, reason `superseded`), so nobody can hold several seeds and play only the kindest. The game therefore sends a finished round's score before it asks for the next round.

### `POST /v1/rounds/{roundId}/score`

The game sends the finished round at game over. The body is `{ signature, taps, score }`:

- `signature`: from `getSignedPlayerInfoAsync(roundId)`, so its `request_payload` names this round. A bad or stale signature, or one for another round, gets `401`. A round that doesn't exist, or belongs to another player, gets `404`.
- `taps`: `Round.taps` as the game logged them, `{ tick, x, y }` in tick order. At most 1,000 taps, ticks from 0 to `MAX_ROUND_TICKS`, coordinates finite. Anything else gets `400`, and the round stays open.
- `score`: the score the game showed.

The server replays the taps from the round's seed and field with `replayRound` and keeps its own score. The round is **ranked** unless one of these applies, in this order (the reason is stored and logged, never shown to the player):

| Reason | When |
| --- | --- |
| `expired` | More than 15 minutes since the round was issued. Not replayed. |
| `rules_version` | The server's rules changed since the round was issued, so it can't be replayed as played. Not replayed. |
| `late_taps` | Taps after the round ended, which the game never logs. |
| `mismatch` | The claimed score isn't the replayed score. The game runs the same simulation, so an honest claim always matches. |
| `too_fast` | The score arrived sooner after the round was issued than the round takes to play: its ticks × 10 ms, less 1 s. |
| `reaction`, `tap_rate` | Past a human limit ([trust model](trust-model.md#what-this-doesnt-stop)). |

The answer is `200` with `{ status, score, best, rank }`:
- `status` is `ranked` or `unranked`. The game says "Score not ranked this round." for `unranked`, whatever the reason.
- `score` is the server's score, or null if the round wasn't replayed.
- `best` is the player's best ranked score, which only goes up.
- `rank` is the player's place by best score, with tied scores sharing a place. It's null while `best` is 0.

A round is decided once. Sending it again, for instance after a lost answer, returns the same answer and changes nothing; so does a round a newer one closed (`unranked`). If two submissions race, only the first result is stored, and only that one can lift the best.

### `GET /v1/leaderboard?player={playerId}`

The answer is `200` with `{ top, player }` (`LeaderboardResponse`), never cached:

- `top`: up to 10 rows of `{ rank, playerId, score }`, best score first. Tied scores share a place and the next place skips (1, 2, 2, 4); among a tie, whoever reached the score first lists first. Players without a best (0) aren't listed.
- `player`: the row for `player`, if given and if they have a best, whether or not they're in `top`. The game pins it under the top 10 when it's outside.

`player` is optional and unverified: the leaderboard is public, and the row says nothing the top 10 doesn't. A value that can't be a player ID gets `400`. The leaderboard is all-time; nightly (the design's "Tonight's brightest") is an open question in the [decisions log](../decisions.md#open-questions).

## Data

The schema is [`apps/server/migrations/0001_init.sql`](../../apps/server/migrations/0001_init.sql). Times are milliseconds since the epoch.

- **players**: `id` (the game-scoped player ID from `FBInstant.player.getID()`), `best_score`, `best_at`, `updated_at`. A row is created with the player's first round, with `best_score` 0.
- **rounds**: `id`, `player_id`, `seed`, `rules_version`, `field_w`, `field_h`, `field_top`, `issued_at`, `expires_at`, `submitted_at`, `taps` (the tap log, kept as evidence), `score` (the server's replay, never the claimed score), `status` (`issued` · `ranked` · `rejected`), `reject_reason`

No names or photos: under SDK 8.0 the game can't read them and the server mustn't store them. The game turns player IDs into names and photos through an overlay view ([D11](../decisions.md#d11-instant-games-sdk-80-under-zero-permissions)).

The leaderboard is a query on `players` ordered by `best_score` descending, then `best_at` ascending, so on a tie the earlier score lists first. Tied scores get the same rank number.

## Hosting

Cloudflare Workers with a D1 (SQLite) database. It's free at this scale, served over HTTPS, has no cold start and doesn't go to sleep, which matters because the backend has to stay up through the review. The Facebook App Secret is stored as a Worker secret and never reaches the client bundle or the repo. See [D7](../decisions.md#d7-host-the-backend-on-cloudflare-workers-with-d1).

**Live at https://glowcatch-api.glowcatch-server.workers.dev** (try `/health`). The Worker runs on the account's own `workers.dev` hostname, apart from anything else on the account. Cloudflare's bot challenges must stay off for it: the game calls it with `fetch`, which can't answer a challenge. Abuse is handled by the API's own checks and rate limits. Requests, errors and logs are in the Cloudflare dashboard under **Workers & Pages → glowcatch-api**; the data is under **Storage & databases → D1 → glowcatch**.

## Before it can serve the game

- [x] The D1 database exists (`wrangler d1 create glowcatch`, region APAC, its ID in `wrangler.jsonc`) and is migrated (`wrangler d1 migrations apply glowcatch --remote`).
- [x] The Worker is deployed (`pnpm --filter @glowcatch/server deploy`).
- [x] `APP_SECRET`, the app's App Secret from the App Dashboard, is set with `wrangler secret put APP_SECRET` (run in `apps/server`, or pass `--name glowcatch-api`; it prompts for the value) and never committed. Without it, every signed request is refused with `401`.
- [ ] The Worker's domain, `glowcatch-api.glowcatch-server.workers.dev`, is on the Facebook app's allowed domains; an Instant Game under SDK 8.0 can only call allowed domains, over HTTPS.

A new migration is applied to the live database with `pnpm --filter @glowcatch/server exec wrangler d1 migrations apply glowcatch --remote`, before deploying the code that needs it.

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
