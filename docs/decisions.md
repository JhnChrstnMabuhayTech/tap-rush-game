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

### D9. Synthesised sound

**Status:** Proposed

The catch chime climbs a pentatonic scale with the streak. Generating it with the Web Audio API means no audio files to download, and the pitch can follow the streak exactly.

---

### D10. Work on a `development` branch

**Status:** Accepted

Day-to-day commits go to `development`; `main` stays as the reviewed, deployable state.

---

## Open questions

| Question | Options | Notes |
| --- | --- | --- |
| Is the leaderboard all-time or nightly? | All-time top 10 · reset every day | The copy "Tonight's brightest" suggests nightly; the brief only asks for a top 10. |
| Is there a Settings screen? | Small sheet (High contrast, sound, reduced motion, How to play) · sound toggle only | The design references Settings but doesn't specify it. |
| Should the `dur-life` token be fixed? | Set to 1900 ms · remove it | It conflicts with the pace table (review note R1). |
