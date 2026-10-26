# Frontend: the game

`apps/game` is the Instant Game: plain TypeScript, one canvas for the play field, DOM screens from the Glowcatch UI kit, bundled by Vite. It runs inside Facebook's player, and in a plain browser tab for development.

**See also:** [architecture](../architecture.md) for how the game, the server and the shared simulation fit together · [design](../design/) for the look, rules and copy · [backend](../backend/) for the API the game calls.

## Source map

```
apps/game/
  index.html                 Loads the Instant Games SDK (pinned to 8.0), then src/main.ts
  public/fbapp-config.json   Bundle config; Vite copies it to the root of the build
  src/
    main.ts                  Boot: platform, loading progress, then the app
    app.ts                   The screen flow: title, countdown, play, paused, game over
    round/                   The play screen: drives the shared Round, draws it, takes taps
      stepper.ts             Frame time → whole 10 ms ticks
      field.ts               The round's logical field, and taps mapped into it
      feedback.ts            Popups and phase banners for each catch and phase, as data
      play.ts                Canvas, HUD, effects layer, input
    storage/best.ts          The best score on this device
    audio/                   Synthesised sound: notes.ts (which notes), sound.ts (the engine)
    title/                   The title's interactive sky: catchable fireflies, bonus visitors, the moon
    badges/                  Achievement badges: badges.ts (which, from the best score), badge-view.ts (how they look)
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
| Screens | A state machine over the flow in [design/states.md](../design/states.md): title, how to play, countdown, play, paused, game over, leaderboard. Pause comes from the HUD button, Escape, a hidden tab or `FBInstant.onPause`, and resumes through a fresh 3-2-1. The title is a small toy: its fireflies can be caught, and bonus visitors name themselves ([D14](../decisions.md#d14-a-title-you-can-play-with)). Seven score badges, from the best score: a collection from the title, and a New badge card or next-badge progress on game over ([D15](../decisions.md#d15-achievement-badges-for-scores-reached)). | Built, except How to play and Leaderboard |
| Game loop | Simulation at a fixed tick from `packages/shared`; drawing every animation frame with the kit's `drawField` and `drawFirefly`. | Built |
| Input | One `pointerdown` handler for touch and mouse, multi-touch, coordinates converted to the simulation's logical units. | Built |
| Audio | Chimes, countdown pips, ticks, round end and a night ambience, synthesised with Web Audio ([D9](../decisions.md#d9-synthesised-sound-with-a-quiet-night-ambience)); unlocked on the first gesture; a Sound toggle on the title and when paused, remembered on the device. | Built |
| Best score | `localStorage` for an instant read, reconciled with `FBInstant.player` data; keep the higher. | On the device; Facebook player data next |
| API client | Timeouts, a retry queue for unsent scores, offline detection. | Planned |
| Share | `renderShareImage` → `FBInstant.shareAsync`; cancelling is not an error. | Built |

Until the server issues rounds (roadmap Phase 3), each round gets a local seed and its score stays on the device.

**Checking it in a browser:** dev builds expose `window.glowcatch.current()`, the live round, so a script can find fireflies and tap them. Production builds leave it out.

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
