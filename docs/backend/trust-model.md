# Trust model

> **Status: in progress** (Phase 3 of the [roadmap](../roadmap.md)). Built: the signature check (`apps/server/src/player.ts`), server-issued rounds (`POST /v1/rounds`), score submission with the replay and plausibility checks (`POST /v1/rounds/{roundId}/score`, `score.ts`, `plausibility.ts`), and rate limits. What remains is checking the signature format against a real one from the staged game.

The brief asks for a backend that "only accepts scores it can trust really came from your game." This page says what that means for Glowcatch: what the server checks, what each check stops, and what it can't stop.

## The short version

1. **Who is playing.** Every request carries a signature from Facebook's `getSignedPlayerInfoAsync`, which the server checks with the App Secret. Nobody can submit a score for a player without playing as that player inside the game on Facebook.
2. **Which round.** The server issues each round with its own ID and random seed. A score is only accepted for a round the server issued to that player, once, within its time limit.
3. **What happened.** The client sends its taps, not just a score. The server replays the round from the seed with the same rules code and works out the score itself. A score the replay can't reproduce isn't ranked.

## How Facebook's signature is checked

`FBInstant.player.getSignedPlayerInfoAsync(requestPayload)` returns a string in the form `<signature>.<payload>`, both base64url-encoded:

- `payload` is JSON: `algorithm` (`HMAC-SHA256`), `issued_at`, `player_id`, `request_payload`.
- `signature` is the HMAC-SHA256 of the encoded payload, keyed with the app's **App Secret**.

That's the long-standing format. SDK 8.0's reference doesn't restate it, so it's checked against a real signature from the staged game before the game relies on the API.

The server recomputes the HMAC and compares the two in constant time (Web Crypto's `verify`), then checks:

- `algorithm` is `HMAC-SHA256`;
- `issued_at` is at most 5 minutes old and at most 1 minute ahead of the server's clock, so an old signature can't be reused;
- on score submission, `request_payload` equals the `roundId`, which ties the signature to this round;
- `player_id` matches the player the round was issued to.

The App Secret lives only on the server (a Worker secret). It's never in the game bundle or in git.

## Threats and checks

| Threat | Check |
| --- | --- |
| Posting a made-up score with `curl` | Needs a valid Facebook signature and a round the server issued. The server computes its own score; a claimed score that differs from the replay leaves the round unranked. |
| Submitting a score as someone else | The signature carries the player ID, and the HMAC can't be forged without the App Secret. |
| Replaying an old, good submission | Each round is single-use and expires 15 minutes after it was issued; the signature must be fresh and name the round. Sending it again gets the first answer back and changes nothing. |
| Sending several tap logs for one round at once, hoping the best one counts | Only the first stored result counts. The round is updated only while it is still open, and the best score only if this request's result is the one stored. |
| Editing the game in devtools to send a bigger score | The replay checks every tap against where a firefly actually was at that moment. Taps on empty sky score nothing, so the score can't go above what the round really spawned. |
| Submitting faster than a real round | The time from issuing the round to receiving the score must be at least the replayed round's length: 30 s of play plus 3 s for each Frost caught, less 1 s of slack. |
| Forcing a favourable seed | The server chooses the seed. It isn't sent until the round starts, a new round means a new seed, and starting a new round closes the last one. |
| Flooding the API | 300 requests a minute per IP; at most 20 rounds started per player in 5 minutes; at most one open round per player. Requests without a valid signature are refused before anything is written. |
| Faking a display name or photo | Nothing to fake: the server stores only player IDs, and Facebook draws each name and photo from the ID (SDK 8.0, [D11](../decisions.md#d11-instant-games-sdk-80-under-zero-permissions)). |

## What this doesn't stop

A program that drives the real game, reads the firefly positions and taps them perfectly will produce a round that replays correctly. No client-side game can fully prevent this. Glowcatch makes it harder and more visible:

- **Plausibility checks** in the replay (`apps/server/src/plausibility.ts`). Rounds that fail are left unranked, with the reason stored:
  - **Reaction:** a catch within 120 ms of the firefly appearing is quicker than a person reacts. A firefly can appear under a finger that's already tapping, so a round may have 3 such catches, or a tenth of its catches if that's more.
  - **Tap rate:** at most 25 taps in any one second, misses included.

  The limits are generous on purpose. Across 500 rounds, a simulated player who reacts in 400 ms is never flagged and taps at most 6 times a second. One that taps each firefly the moment it appears is flagged every time.
- **Stored evidence**: every round keeps its seed and tap log, so suspicious scores can be re-checked or removed later.

That's an honest limit, and it's the right trade-off for a casual game: it stops everything that's cheap to do, and it makes the expensive attacks visible.

## Local development

Outside Facebook there's no real signature. In its place, the game's local stand-in sends `unsigned.<payload>`: the same payload, with the word `unsigned` where the signature goes. The server accepts it only when both hold:

- `ALLOW_UNSIGNED=true` is set, which only `apps/server/.dev.vars` does. That file is gitignored and `wrangler deploy` never reads it.
- The request is to `localhost` or `127.0.0.1`. A deployed Worker is only reached through its own hostname, so even a flag set there by mistake opens nothing.

Everything else about the payload is still checked (algorithm, freshness, player ID). Tests cover both conditions, and one fails if `wrangler.jsonc`, which is what deploys, ever sets the flag.
