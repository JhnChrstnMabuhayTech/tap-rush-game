# Design

Glowcatch's look, feel and rules come from the **Glowcatch design system**, built in Claude (Cowork) before any game code. The system itself is a private artifact on claude.ai. This folder is a snapshot of it, so the repo can be read and built without access to the original.

| File | What it covers |
| --- | --- |
| [brand.md](brand.md) | Principles, voice and copy, colour, type, spacing, layout for phone and desktop, motion and sound, accessibility |
| [gameplay.md](gameplay.md) | The round: pace curve, phases, combo and streak clock, bonus fireflies, hit testing, pausing, trust |
| [states.md](states.md) | Screen flow, best-score handling, every edge case, and the full copy deck |
| [components.md](components.md) | Guidelines for each component in the UI kit |
| [tokens.json](tokens.json) | Every design token: colours (Night and High contrast), type, spacing, radius, glow, sizes, durations, easing, z-index |
| [assets/](assets/) | The logo mark and the 1024×1024 app icon |

**Snapshot:** version `1792632918-1c3e`, taken 2026-10-22.

## Keeping it in sync

The design system is the source. When it changes:

1. Re-export the `project/` files from the design system.
2. Replace the matching files here, keeping the snapshot note at the top of each.
3. Update the snapshot version above.
4. Check the [review notes](#review-notes) below. Close the ones the change resolves and add any new conflicts.

Code doesn't read these files. The game gets its tokens and components from the UI kit in `apps/game`, and the rules come from `packages/shared` (see [../architecture.md](../architecture.md)). If a rule changes here, change it in `packages/shared` in the same commit.

## Review notes

These are the gaps and conflicts found when the snapshot was reviewed against the brief and the UI kit's code. Each needs a decision before or during the build. Decisions go in [../decisions.md](../decisions.md).

### Conflicts in the system

| # | Issue | Where | Proposed resolution |
| --- | --- | --- | --- |
| R1 | The `dur-life` token says a firefly lives 1600 ms at the start of a round, but the pace table and the kit's `CURVE` say 1900 ms. | tokens.json, gameplay.md | `CURVE` wins (it's what the code runs). Update the token to 1900 ms, or drop it, since lifetime comes from the curve. |
| R2 | gameplay.md says the rules live in `Glowcatch.CURVE`, but the kit's type definitions don't declare `CURVE` or `PHASES` (the bundle does export them). | gameplay.md, index.d.ts | **Resolved:** the rules live in `packages/shared` (R4). |
| R3 | Frost and Swarm catches score combo points in the kit (`pointsFor`), but the bonus table lists only their effects. | gameplay.md | Document it: every catch except Lantern scores 1 × combo. |
| R13 | The kit reads duration tokens with `parseFloat` and assumes milliseconds (`ms()`), and its gradient helper (`clear()`) only accepts 6-digit hex or `rgba()`. Any stylesheet tool that writes `.8s` or `#rrggbbaa` breaks it silently; Vite's minifier did. | bundle.js | In the game: CSS ships unminified and a build check guards the tokens. For the design system: parse units (`ms`/`s`) and every colour form. |

### The reference loop isn't replayable as written

The `PlayField` demo in the kit is the reference implementation of a round. It's right for feel, but the server can't use it to replay a round.

**Resolved:** `packages/shared` ports the rules and runs the round as a deterministic simulation, applying each resolution below ([D13](../decisions.md#d13-how-the-simulation-stays-replayable)). A test in `apps/game` fails if the kit's copy of the rules drifts from it.

| # | Issue | Why it matters | Resolution |
| --- | --- | --- | --- |
| R4 | The rules live in a browser bundle (`window.Glowcatch`). | The server can't import them. | Port `CURVE`, `BONUSES`, `comboFor`, `pointsFor`, `pace` and `difficulty` to `packages/shared` as plain TypeScript. The game and the server both import them from there. |
| R5 | The loop steps by the browser's frame time, and spawn timers reset to 0 instead of carrying the remainder. | Spawn timing depends on frame rate, so a 60 Hz phone and a 120 Hz phone play different rounds from the same seed. | The shared simulation steps at a fixed tick, and taps are applied at tick boundaries. |
| R6 | Positions are in screen pixels. | The same seed lays out differently on every screen size. | The simulation runs in logical units for the frame size captured at round start. Rendering scales to the current frame. |
| R7 | Spawn spacing is checked against drifted positions with `Math.sin` and `Math.hypot`. | JavaScript engines may round these differently in the last bits (Facebook's iOS webview vs V8 on the server). A tiny difference can flip a spawn decision and the replay drifts apart. | Spacing checks use base positions and plain arithmetic only. Taps are hit-tested with a small tolerance. |
| R8 | The random generator returns one of only 10,000 values (`% 10000`). | Fine for visuals, too coarse for spawn positions. | The shared simulation uses a full-precision seeded generator. |

### Conflicts with the platform

| # | Issue | Where | Proposed resolution |
| --- | --- | --- | --- |
| R9 | SDK 8.0 gives game code no player names or photos ([D11](../decisions.md#d11-instant-games-sdk-80-under-zero-permissions)), but `Leaderboard` rows show a name and a photo (or initials), and `renderShareImage` takes a `name`. | components.md, states.md | Render leaderboard names and photos in an overlay view, styled with the tokens; keep the kit's `Leaderboard` for its loading, empty, error and offline states. Share images go out without a name. |

### Deliberate departures

| # | Departure | Where | Status |
| --- | --- | --- | --- |
| R10 | The title sits over its own interactive field, not `PlayField({ ambient: true })`: catchable fireflies, bonus visitors, a moon, and a new hint string, "Tap a firefly" (`title.hint`). | components.md (TitleScreen), states.md (Title, copy deck) | Accepted in the game ([D14](../decisions.md#d14-a-title-you-can-play-with)). To carry back into the design system: the TitleScreen guidance and the `title.hint` copy key. |
| R11 | Achievement badges, which the design system doesn't have: a medallion (a firefly of each kind on a night disc, lit or unlit), a collection sheet, a "New badge" card on game over, a next-badge progress line, and a "Badges n/7" title button. New copy: the seven badge names, "n of 7 earned", "New badge", "Score n in a round", "Next badge: … at n", "n to go". | components.md, states.md | Accepted in the game ([D15](../decisions.md#d15-achievement-badges-for-scores-reached)). To carry back: a Badge component and the copy keys. |
| R12 | Game over gains a Home button (ghost, under Share and Play again) and Escape goes home. The design's game over had no way back to the title, which mattered once the title held the badges. | states.md (Flow, Game over), components.md (GameOver) | Accepted in the game. To carry back: a third GameOver action and the `over.home` copy key ("Home"). |

### Gaps

| # | Gap | Proposed resolution |
| --- | --- | --- |
| G1 | Settings is mentioned (High contrast theme, sound, reduced motion, How to play), but it has no screen in the flow and no component. | Small Settings sheet built from existing parts: Button toggles in a `.gc-panel`. Scope decision pending. |
| G2 | "Tonight's brightest" suggests a nightly leaderboard, but the brief only asks for a top 10. | Pending: all-time or daily. |
| G3 | No audio files. The chime "climbs a pentatonic scale". | Synthesise the chimes with the Web Audio API: no downloads, and the pitch can follow the streak. |
| G4 | No font file (`type.fonts` is empty). | Self-host a Latin subset of Bricolage Grotesque (SIL Open Font License) as woff2, under 40 KB. |
| G5 | The app icon is SVG; Facebook needs a 1024×1024 PNG. | **Resolved:** `assets/glowcatch-app-icon.png`, rendered from the SVG at 1024×1024. Re-export it if the SVG changes. |
| G6 | `bundle.css` loads the font with an `@import` from Google Fonts. Under SDK 8.0 the game may only reach allowed domains, so the request may be blocked. | Resolved together with G4: self-host the font and drop the `@import` from the game's copy of the kit. |
