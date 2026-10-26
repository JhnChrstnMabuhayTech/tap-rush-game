# Decisions

Each choice that shapes the project, why it was made, and what it costs. Entries marked **Proposed** aren't settled yet. Newest entries go at the bottom.

---

### D1. One monorepo with a shared package

**Status:** Accepted

The brief asks for the game and backend in one repository. Beyond that, the game and the server need the *same* rules to agree on a score, so the rules and the round simulation live in `packages/shared` and both apps import them.

**Cost:** a workspace setup (pnpm workspaces) instead of two independent projects.

---

### D2. Rename the game to Glowcatch, with a fireflies theme

**Status:** Accepted

The brief invites a rename and a theme. Glowcatch turns the shrinking circles into fireflies whose light is fading, so the core mechanic (appear, shrink, tap) is also the story. The full direction is in the [design system snapshot](design/README.md).

The repository keeps the name `tap-rush-game` so reviewers can match it to the assignment (**Proposed**; renaming is one command and GitHub redirects the old URL).

---

### D3. Combo multiplier and bonus fireflies on top of the core scoring

**Status:** Accepted

The brief says "tapping one scores a point" and "keep the core gameplay", and also asks to "rethink the game and make it your own". Glowcatch keeps the core (every firefly appears, shrinks and is caught with one tap) and adds:

- a combo: ×2 from 5 catches in a row, ×3 from 10;
- three bonus fireflies: Lantern (+5), Frost (stops the clock for 3 s), Swarm (six quick fireflies).

**Why:** a flat one-point-per-tap round has no reason to play carefully; a combo rewards accuracy and gives the round a rhythm.

**Cost and mitigation:** reviewers could read "scores a point" literally. Game over also shows **Caught**, the plain one-per-firefly count, next to the score, so the original measure is always visible.

---

### D4. Pace driven by score as well as time

**Status:** Accepted

`pace = clamp(0.4 × elapsed / 30 + 0.6 × score / 90)`. Strong players reach the fast phase early; everyone gets there by the end.

**Cost:** what spawns next depends on what the player has caught, so the server can't check a score against a fixed schedule. It has to replay the whole round (D6).

---

### D5. Plain TypeScript with Canvas and DOM, no game engine or framework

**Status:** Accepted (build tool: **Proposed**, Vite)

The Glowcatch UI kit is framework-free by design: components are `(props) => HTMLElement`, the play field is one canvas. An Instant Game must load fast inside Facebook, and a game engine would add hundreds of kilobytes for features this game doesn't use.

**Cost:** game-loop, input and scene handling are written by hand. At this size that's a few hundred lines.

**CSS ships unminified.** The kit reads design tokens at runtime, and a minifier rewrites them (`800ms` → `.8s`, `rgba()` → 8-digit hex), which broke the countdown, the catch popups and the sky's gradients in production. Minification would save about 2 KB gzipped. `scripts/check-build.ts` fails the build if any token changes.

---

### D6. The server replays every round from a seed

**Status:** Accepted

The server issues a seed with each round. The client sends its tap log, and the server re-runs the round with the shared simulation to compute the score. See [backend/trust-model.md](backend/trust-model.md).

**Cost:** the simulation must be deterministic on every device and on the server: fixed tick, logical coordinates, a full-precision seeded generator, and no engine-dependent maths in game decisions. The kit's demo loop doesn't do this yet, so the rules are ported to `packages/shared` (review notes R4–R8 in [design/README.md](design/README.md#review-notes)).

---

### D7. Host the backend on Cloudflare Workers with D1

**Status:** Proposed

The backend must stay on a public HTTPS URL until the review ends. Workers is free at this scale, has no cold starts and doesn't sleep. D1 (SQLite) is enough for players, rounds and a top-10 query.

**Alternatives:** Node on Fly.io or Render with Postgres. Render's free tier sleeps after inactivity, which risks a slow or failed first request during the review.

---

### D8. Best score in three places

**Status:** Accepted

`localStorage` gives an instant read on the title screen; `FBInstant.player` data follows the player across devices; the server's best is what the leaderboard shows. The game keeps the highest of the first two and never blocks a screen on a network write.

---

### D9. Synthesised sound, with a quiet night ambience

**Status:** Accepted

Each catch chimes the next note of a short tune, and a broken streak starts a different one. (The design had the chime climb a pentatonic ladder, which repeated the same do-re-mi every streak.) Generating the sound with the Web Audio API means no audio files to download, and the notes can follow the streak exactly.

Everything sits in G major pentatonic, so no two sounds clash. There are six original twelve-note tunes, written to loop; a new streak never repeats the last one. From ×2 the tune plays an octave higher, and at ×3 a soft octave below joins it, so a streak still sounds like it's building. A new multiplier rings D-G or G-B above it, and each bonus has its own figure, built by stepping up the scale rather than by fixed ratios, which would leave the key. The countdown pips climb D, E, G into a G strum on "Go!". The last five seconds tick, and the round ends by settling back to G.

**Music: an ambience under the round, generated music on the title.** The design specified sound effects only. After the first staged build had no sound at all, we chose a quiet night ambience under the round: a low G-D-B pad and occasional crickets, about 16 dB under the chimes (measured from a recording of the engine). A looped tune was rejected there: it would clash with the chimes and grow repetitive over many 30-second rounds. Later the title asked for real music, so it plays calm music generated as it goes (`apps/game/src/audio/music.ts`). Open-fifth chords move G, E, A, D, two bars each at 64 bpm; a music-box melody wanders mostly by step and settles on a chord tone each bar; a soft low note marks the bar. All of it is in G major pentatonic, so it never clashes with the chimes, and because it's generated it never repeats on a loop. It peaks about 7 dB under the chimes. Audio is attempted at launch; where the browser holds it, the first tap starts it.

**Cost:** browsers block audio until the player touches the page, so nothing plays on the title until the first tap. iOS only counts touchend and click as that touch, so the game listens for those too.

---

### D10. Work on a `development` branch

**Status:** Accepted

Day-to-day commits go to `development`; `main` stays as the reviewed, deployable state.

---

### D11. Instant Games SDK 8.0, under Zero Permissions

**Status:** Accepted (required by Meta)

Meta moved Instant Games to SDK 8.0, "Network Enabled Zero Permissions" (NEZP). Games that hadn't migrated by 30 September 2026 are no longer reachable on Facebook, so a new game has to start on 8.0. For Glowcatch that means:

- **No names or photos in game code.** `player.getName()` and `getPhoto()` are gone. Meta renders names and photos itself, inside *overlay views*: an iframe built from an XML template and a CSS file in our bundle. The game positions and sizes the iframe and passes it data such as player IDs, ranks and scores, but can't read what it shows.
- **No names or photos on our server.** Games under NEZP keep player IDs and gameplay data only, and must not try to re-identify players.
- **Network calls go only to allowed domains,** over HTTPS. The backend's domain has to be on the app's Content Security Policy allowlist.
- **What stays:** `getSignedPlayerInfoAsync` (now the main way to prove identity to a server), a game-scoped `player.getID()`, `getDataAsync`/`setDataAsync` (best score, D8) and `shareAsync`.

**What changes from the design:** the backend stores player IDs and scores only. The leaderboard's names and photos come from an overlay view fed with player IDs from our API, and the share image drops the player's name. The design system assumed both (review note R9 in [design/README.md](design/README.md#review-notes)).

**Proposed:** draw the whole top-10 list as one overlay view, styled with our tokens in its CSS, rather than one overlay per row (ten iframes). To be proven in Phase 4.

---

### D12. Toolchain versions

**Status:** Accepted

| Tool | Version | Why not the newest |
| --- | --- | --- |
| Node.js | 22.12+, 24 in `.nvmrc` | Vite 8 and Wrangler 4 need 22.12; 24 is the current LTS. |
| pnpm | 11 | It's the newest. Two of its defaults stay on: install scripts only run for packages listed under `allowBuilds` (workerd and esbuild, which Wrangler needs), and releases younger than a day aren't installed (`minimumReleaseAge`), a cheap guard against a compromised publish. |
| TypeScript | 6.0 | typescript-eslint 8 supports TypeScript below 6.1, so 7.0 would leave linting unsupported. |
| Vitest | 4.1 | `@cloudflare/vitest-pool-workers`, which runs tests inside the Workers runtime with a real D1, supports Vitest 4.1 only. The server's integration tests need it in Phase 3. |
| Vite | 8 | It's the newest. |

**Cost:** TypeScript and Vitest are a major version behind. Revisit when typescript-eslint and the Workers pool catch up; nothing in the code depends on the older versions.

---

### D13. How the simulation stays replayable

**Status:** Accepted

The shared simulation follows the kit's reference loop, with these choices:

- **A 10 ms tick.** Every timer is a whole number of milliseconds, a round is 3,000 to 3,600 ticks (cheap to replay on a Worker), and a tap waits at most 10 ms for its tick.
- **Logical units are the frame's CSS size at round start.** Firefly size already scales with the frame (`min(1.25, shortSide / 390)`), so the round plays the same as the kit's demo at any size. The server records the field size with the round.
- **mulberry32 for randomness.** It's small, well known and uses integer operations only, which every engine computes identically.
- **Approximated curves where a decision depends on them.** Drift uses a sine approximated within 0.1%; the visible radius uses life^0.7 sampled at 17 points, within 1.5% for the first 15/16 of a life. Both differences are invisible on screen, and the game will draw each firefly where the simulation puts it.
- **Spawn timers carry their remainder,** where the kit reset them to 0, and hold rather than build a backlog when the field is full. The cadence stops depending on frame timing.
- **Kept from the kit:** Frost leaves the bonus pool after two have been *caught*, not spawned, so a missed Frost doesn't use up a freeze; the first firefly arrives at 940 ms rather than 950, because the clock nudges the pace up before it.

**Cost:** changing a rule or a curve changes how existing rounds replay. Every round records `RULES_VERSION`; a change bumps it, and the server either keeps the old version to replay rounds issued under it, or leaves those few in-flight rounds unranked.

---

### D14. A title you can play with

**Status:** Accepted

The design puts the title over the kit's ambient field: three dim fireflies, and nothing to do but press Play. On a phone that left the top half of the screen as empty sky, and the first staged build felt plain. The title now has its own field (`apps/game/src/title`):

- **Catchable fireflies:** three to five glow above the name and can be caught, with the same burst and chime as a round. A streak warms the horizon, so the combo is felt before it's explained.
- **Bonus visitors:** a Lantern, a Frost and a Swarm visit in turn, and catching one names it with the How to play copy. The title teaches the bonuses through play before anyone reads about them.
- **A one-time hint:** "Tap a firefly", if nothing has been touched for 3.5 s.
- **An eager Play:** after three catches, Play's invitation breathes faster.
- **The moon:** a low moon balances the Sound toggle.
- **How to play:** as the design has it, the panel comes up once, before a player's first round. After that, a button under Play opens it at any time. The design keeps it in Settings after the first round; on the title it sits where a new player looks first.

**Why a toy rather than more decoration:** the brief rewards "feels right to play" and creativity. A home screen you can touch makes people curious about the real thing, and it teaches the mechanic in the first second.

**Cost:** the title no longer follows the design system's TitleScreen guidance (review note R10), and it's another canvas loop to keep light. Nothing on the title is scored or sent anywhere.

---

### D15. Achievement badges for scores reached

**Status:** Accepted

Seven badges, one for each score a player reaches in a single round. They give every round a goal beyond the best score, and a reason to come back.

| Badge | Score | Who it's for |
| --- | --- | --- |
| First light | 10 | Everyone, in their first round |
| Spark catcher | 40 | A casual player's first few rounds |
| Lantern keeper | 75 | A casual player at their best |
| Night watcher | 120 | An average player |
| Meadow glow | 170 | An average player at their best |
| Moon catcher | 230 | A strong player |
| Starfield | 280 | Near-perfect play |

**Where the numbers come from:** 300 simulated rounds per player model, run on the shared simulation. Casual (0.9 s to react, 65% accurate) has a median of 56 and a 90th percentile of 75. Average (0.6 s, 80%) is 145 and 169. Strong (0.4 s, 92%) is 243 and 268. Perfect play is 252 and 277, with a maximum of 311. Real players will differ from the models, so the thresholds should be revisited once there are real scores.

**Badges are read from the best score**, not stored on their own, so they can't disagree with it. When the best syncs with Facebook's player data or the server, the badges follow.

**What each badge looks like:** a firefly of its own kind on a medallion. Earned ones glow; locked ones are a firefly whose light is nearly out. The light stays the UI, and no new colour joins the palette. New badges use lime ("better than before").

**Left out on purpose:** achievements for anything other than score, such as catching three Frosts or holding ×3 for ten seconds. The request was for scores reached, and seven score badges are easy to understand at a glance.

**Cost:** badges earned on the device trust the device, as the local best already does. They're cosmetic and never ranked. Once scores are verified by the server, badges can be read from the server's best instead.

---

### D16. Music and sound effects, switched separately

**Status:** Accepted

One Sound switch used to mute everything. Players often want the effects without the music (or the other way round), so the engine has two buses, each with its own setting, remembered on the device:

- **Music:** the ambience under the round, and music on the title.
- **Sound effects:** catch chimes, the countdown, the last-seconds ticks and the round's end.

The switches live in a **Sound** sheet behind a speaker in the title's top-right corner, which fills design gap G1 for sound, and in the pause panel. The speaker shows muted when both are off. (It's a speaker, not the kit's settings glyph, which reads as a sun: design review note G7.) Each is a row with the label, its state as a word, and a sliding knob (`role="switch"`): the kit has no switch, so it's built from the tokens, and the state is never colour alone.

**Cost:** two settings instead of one. A player who had muted the old switch keeps both off.

---

## Open questions

| Question | Options | Notes |
| --- | --- | --- |
| Is the leaderboard all-time or nightly? | All-time top 10 · reset every day | The copy "Tonight's brightest" suggests nightly; the brief only asks for a top 10. |
| Is there a Settings screen? | Small sheet (High contrast, sound, reduced motion, How to play) · sound toggle only | The design references Settings but doesn't specify it. |
| Should the `dur-life` token be fixed? | Set to 1900 ms · remove it | It conflicts with the pace table (review note R1). |
| How is the leaderboard drawn under SDK 8.0? | One overlay view for the whole list · an overlay per row · names and photos left out | Names and photos can only come from an overlay view ([D11](#d11-instant-games-sdk-80-under-zero-permissions)). One overlay is lighter; how closely its XML and CSS can match the kit's `Leaderboard` is unproven. |
