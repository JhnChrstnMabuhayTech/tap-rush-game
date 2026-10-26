# Architecture

> **Status: draft.** Nothing here is built yet. This is the design the build starts from; it gets updated as code lands.

Glowcatch has two parts in one repo:

- **The game**: a Facebook Instant Game, plain TypeScript with Canvas and DOM, built on the Glowcatch UI kit.
- **The backend**: a small HTTPS API that issues rounds, checks scores and keeps the leaderboard.

They share one package, the **round simulation**. Because the server runs the same code as the game, it can replay a round from its seed and the player's taps and work out the score itself.

```mermaid
flowchart LR
  subgraph FB["Facebook (Instant Games host)"]
    G["apps/game<br/>Canvas + DOM, Glowcatch UI kit"]
  end
  S["packages/shared<br/>rules + round simulation"]
  API["apps/server<br/>HTTPS API"]
  DB[("Database<br/>players, rounds")]
  G -- imports --> S
  API -- imports --> S
  G -- "start round, submit taps, leaderboard" --> API
  API --> DB
```

## Repository layout

```
apps/game/         The Instant Game: boot, screens, game loop, input, audio, API client
apps/server/       The leaderboard API
packages/shared/   Rules (curve, combo, bonuses), seeded random generator, round simulation, API types
docs/              Architecture, frontend/ (the game), backend/ (the server and trust model),
                   design snapshot, decisions, roadmap
```

## A round, end to end

```mermaid
sequenceDiagram
  participant P as Player
  participant G as Game
  participant FB as FBInstant SDK
  participant API as Backend

  P->>G: Play
  G->>FB: getSignedPlayerInfoAsync()
  FB-->>G: signature
  G->>API: POST /v1/rounds (signature, name, photo, field size)
  Note over G: 3-2-1-Go runs while this request is in flight
  API-->>G: roundId, seed, rulesVersion
  loop 30 s of play
    P->>G: tap
    G->>G: simulate from seed, record tap (tick, x, y)
  end
  G->>P: Game over screen with the local score, right away
  G->>FB: getSignedPlayerInfoAsync(roundId)
  FB-->>G: signature bound to this round
  G->>API: POST /v1/rounds/{roundId}/score (signature, taps, claimed score)
  API->>API: verify, replay the round, compute the score
  API-->>G: ranked or unranked, score, best, rank
  G->>API: GET /v1/leaderboard
  API-->>G: top 10 and the player's own row
```

If the round can't be started (offline, server down), the game still plays from a local random seed. The score is kept on the device and game over says "Score not ranked this round." Play is never blocked by the network.

## The game (`apps/game`)

Boot, screens, the game loop, input, audio, best score, the API client and sharing. Module by module, with how to run and upload it: [frontend/](frontend/).

## The backend (`apps/server`)

Endpoints, the data model and hosting, with how to run and deploy it: [backend/](backend/).

## The shared simulation (`packages/shared`)

The rules in [design/gameplay.md](design/gameplay.md) are ported from the UI kit into plain TypeScript here, so the game and the server can't disagree. For the server's replay to land on exactly the same score, the simulation has to be **deterministic**: same seed and same taps, same result, on every device and on the server.

| Rule | Why |
| --- | --- |
| Fixed tick; taps applied at tick boundaries | Frame rate (60 Hz vs 120 Hz, dropped frames) must not change the round. |
| Logical coordinates for the frame size captured at round start | Screen size must not change where fireflies spawn. A mid-round resize only rescales the drawing. |
| Full-precision seeded random generator, one stream, fixed draw order | Every decision draws the same numbers in the same order. |
| Game decisions use plain arithmetic only (no `Math.sin` or `Math.hypot`) | Engines may round those differently; drift that uses them is visual only. |
| A `rulesVersion` on every round | A rules change never breaks replay of rounds already in flight. |

The kit's own demo loop doesn't meet these rules yet; see the review notes in [design/README.md](design/README.md#review-notes).

How the server decides whether to trust a score is in [backend/trust-model.md](backend/trust-model.md).
