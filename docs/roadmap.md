# Roadmap

The build order, chosen to get the riskiest unknowns out of the way first: Facebook hosting, the reviewers' access and the backend's trust check.

## Phase 0: Prove the Facebook pipeline

- [x] Meta developer account and a Facebook app with the Instant Games product (app ID `1377676130860334`)
- [x] App details filled in (name, category, icon from [design/assets](design/assets/))
- [x] A "hello world" bundle (`index.html` + `fbapp-config.json`) that initialises the SDK and starts the game: `pnpm --filter @glowcatch/game bundle`
- [x] Zipped with `index.html` at the root, uploaded under Web Hosting, moved to **Testing** (never Production)
- [ ] Loads at `facebook.com/gaming/play/<APP_ID>/` on desktop and in the Facebook app on a phone
- [ ] Reviewers added as **Testers** under App Roles. A staged game only loads for people with a role on the app.

## Phase 1: Monorepo and tooling

- [x] Public GitHub repository, `development` branch
- [x] Design system snapshot in [docs/design](design/)
- [x] pnpm workspaces: `apps/game`, `apps/server`, `packages/shared`
- [x] TypeScript, ESLint, Prettier, Vitest
- [x] UI kit vendored into `apps/game`; `tokens.css` generated from `tokens.json`
- [ ] Bricolage Grotesque Latin subset (woff2, under 40 KB)
- [x] GitHub Actions: lint, format, type-check, test, build

## Phase 2: The round, running locally

- [x] Rules ported to `packages/shared`: curve, phases, combo, bonuses
- [x] Deterministic simulation: seeded generator, fixed tick, logical coordinates, tap log
- [x] Tests: same seed and taps give the same score; frame rate doesn't change the round
- [x] Game loop, `pointerdown` input with multi-touch, hit testing with slop
- [x] Screens: title, countdown, play, paused, game over
- [ ] Screens: how to play, leaderboard
- [x] FBInstant mock for plain-browser development

## Phase 3: Backend and trust

- [ ] `POST /v1/rounds`, `POST /v1/rounds/{id}/score`, `GET /v1/leaderboard`, `GET /health`
- [ ] Signature verification (HMAC-SHA256 with the App Secret), with tests
- [ ] Server-side replay and plausibility checks, with tests for forged, replayed and impossible rounds
- [ ] Rate limits, CORS for the Instant Games origin
- [ ] Backend domain on the app's CSP allowlist (SDK 8.0)
- [ ] Deployed to a public HTTPS URL

## Phase 4: Facebook integration

- [x] Real loading progress, `startGameAsync` when the title can render
- [x] Best score on the device (`localStorage`)
- [ ] Best score in `FBInstant.player` data, reconciled with the device
- [x] Share with an image (`renderShareImage` → `shareAsync`)
- [ ] Leaderboard names and photos through an overlay view ([D11](decisions.md#d11-instant-games-sdk-80-under-zero-permissions))
- [x] Pause on `FBInstant.onPause` and `visibilitychange`
- [ ] Tested through the embedded player with a local HTTPS server

## Phase 5: Feel and polish

- [ ] Title intro, catch bursts, float text, phase banners, warming sky
- [x] Synthesised chimes, mute toggle, haptics where supported
- [x] A quiet night ambience under the round (pad and crickets)
- [x] An interactive title: catchable fireflies and bonus visitors
- [x] Achievement badges for scores reached, with a collection and progress to the next
- [x] Sound settings: Music and Sound effects switched separately
- [x] Calm generated music on the title
- [ ] High contrast theme and reduced motion
- [ ] Share card checked on Facebook's crops

## Phase 6: When things go wrong

- [ ] Offline and backend-down: play continues, scores queue and retry
- [ ] Every edge case in [design/states.md](design/states.md#edge-cases)
- [ ] Small and large screens, landscape, resize mid-round

## Phase 7: Ship to Testing

- [ ] Build-and-zip script (optionally upload through the Graph API)
- [ ] Full run-through: phone, desktop, a tester account, backend down

## Phase 8: Hand-in

- [ ] README complete: run locally, deploy, architecture, trust model, trade-offs
- [ ] Decisions log up to date
- [ ] Play link and repository link sent
