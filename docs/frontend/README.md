# Frontend: the game

`apps/game` is the Instant Game: plain TypeScript, one canvas for the play field, DOM screens from the Glowcatch UI kit, bundled by Vite. It runs inside Facebook's player, and in a plain browser tab for development.

**See also:** [architecture](../architecture.md) for how the game, the server and the shared simulation fit together · [design](../design/) for the look, rules and copy · [backend](../backend/) for the API the game calls.

## Source map

```
apps/game/
  index.html                 Loads the Instant Games SDK (pinned to 8.0), then src/main.ts
  public/fbapp-config.json   Bundle config; Vite copies it to the root of the build
  src/
    main.ts                  Boot: platform, loading progress, then the title
    platform/                Where the game runs: the FBInstant SDK, or a local stand-in
    ui/kit.ts                The one place the UI kit is imported
    kit/                     The vendored Glowcatch UI kit; don't edit (see its README)
    styles.css               Page shell
  scripts/
    build-tokens.ts          src/kit/tokens.json → tokens.css (`pnpm tokens`)
    zip.ts                   dist/ → release/glowcatch-<commit>.zip (`pnpm bundle`)
```

## Modules

| Module | Job | Status |
| --- | --- | --- |
| Boot | `FBInstant.initializeAsync`, real loading progress, `startGameAsync` once the title can render. Outside Facebook a local stand-in replaces the SDK. | Built |
| Screens | A state machine over the flow in [design/states.md](../design/states.md): title, how to play, countdown, play, paused, game over, leaderboard. | Title only |
| Game loop | Simulation at a fixed tick from `packages/shared`; drawing every animation frame with the kit's `drawField` and `drawFirefly`. | Planned |
| Input | One `pointerdown` handler for touch and mouse, multi-touch, coordinates converted to the simulation's logical units. | Planned |
| Audio | Chimes synthesised with Web Audio, unlocked on the first tap, mute remembered. | Planned |
| Best score | `localStorage` for an instant read, reconciled with `FBInstant.player` data; keep the higher. | Planned |
| API client | Timeouts, a retry queue for unsent scores, offline detection. | Planned |
| Share | `renderShareImage` → `FBInstant.shareAsync`; cancelling is not an error. | Planned |

Until the game loop lands, Play runs the UI kit's own reference round, so a build can be smoke-tested on Facebook.

## Facebook platform constraints

The game runs on Instant Games SDK 8.0 under Zero Permissions ([D11](../decisions.md#d11-instant-games-sdk-80-under-zero-permissions)):

- The game never sees player names or photos. Leaderboard rows get them from an overlay view: an iframe Facebook renders from an XML template and CSS in our bundle, fed with player IDs.
- Network requests go only to domains on the app's CSP allowlist: the backend, and nothing else. Fonts and images ship in the bundle.
- The share image carries the score, not the player's name.
- `fbapp-config.json` uses `NAV_BAR`, so Facebook's menu sits above the game rather than floating over the HUD. Check it on a phone in Phase 0.

## Running it

All commands run from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm --filter @glowcatch/game dev` | Dev server on http://localhost:5173, with the local stand-in for the SDK |
| `pnpm --filter @glowcatch/game dev:fb` | The same over HTTPS (self-signed), for Facebook's embedded player |
| `pnpm --filter @glowcatch/game build` | Production build in `apps/game/dist` |
| `pnpm --filter @glowcatch/game bundle` | Build, then zip it for Web Hosting into `apps/game/release/` |
| `pnpm --filter @glowcatch/game tokens` | Regenerate `src/kit/tokens.css` after the tokens change |

**Which platform:** in a top-level browser tab the game uses the local stand-in; inside Facebook's iframe it uses the real SDK. Add `?platform=local` or `?platform=facebook` to override.

**Inside Facebook, from your machine:** run `dev:fb`, open https://localhost:5173 once and accept the certificate, then open `https://www.facebook.com/embed/instantgames/1377676130860334/player?game_url=https://localhost:5173`. You need a role on the app (admin, developer or tester).

**The app:** ID `1377676130860334`, play link https://www.facebook.com/gaming/play/1377676130860334/. The App Secret belongs only in the Worker's secrets (`wrangler secret put APP_SECRET`), never in the repo, a committed file or chat.

## Uploading a build

1. `pnpm --filter @glowcatch/game bundle`. The zip has `index.html` and `fbapp-config.json` at its root, which Web Hosting requires.
2. In the App Dashboard, open **Use cases → Launch an Instant Game on Facebook and Messenger → Customize → Web hosting**, click **Upload Version** and pick the zip. Start the version comment with the commit the build came from (it's in the zip's name), then what changed: `30c683c: first build. Title screen + placeholder round`.
3. Click the beaker icon on the new version (**Stage for testing**). Only people with a role on the app can play it.
4. **Never** click the rocket icon (**Push to production**). The brief is for a staged game only.
