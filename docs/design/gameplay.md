# Gameplay and feel

> Snapshot of the Glowcatch design system, version `1792632918-1c3e` (2026-10-22). The design system is the source; see [README.md](README.md) for how to re-sync.

The rules every build of the round follows. The numbers are starting values for playtesting. They live in one place, `Glowcatch.CURVE`, `Glowcatch.BONUSES` and `Glowcatch.comboFor`, so the game, these docs and the server read the same rules. Change them there, not in code comments.

## The round

- One round is 30 seconds of play, after a 3-2-1-Go countdown (`dur-count` per step). The clock runs on `performance.now()` deltas, never on `setInterval` counts. Frost (below) can stop it, so a round can run up to 36 seconds of wall-clock time.
- A normal firefly scores **1 point × the combo multiplier**. A Lantern scores a flat 5.
- The core loop is untouched: circles appear and shrink, and tapping one scores.

## Pace: slow start, faster as you score

Every round opens gently, like most casual games, and speeds up from there. The speed is set by **pace**, a number from 0 to 1 that blends the clock and the score:

`pace = clamp(0.4 × elapsed / 30 + 0.6 × score / 90)`

- Scoring is what mostly drives it: a player on a hot streak reaches Midnight in 15 seconds, and a player who is struggling still gets there by the end of the round, so every round has an ending that feels fast.
- Frozen time doesn't count as elapsed.
- Pace never goes down, because score and time only ever rise.

| | Pace 0 (opening) | ⅓ — Night falls | ⅔ — Midnight | 1 |
|---|---|---|---|---|
| Spawn interval | 950 ms | 620 ms | 460 ms | 340 ms |
| Alive at once (max) | 2 | 3 | 5 | 6 |
| Lifetime | 1900 ms | 1450 ms | 1150 ms | 850 ms |
| Diameter (× `firefly-start`) | 1.08 | 0.95 | 0.82 | 0.70 |
| Drift | 4 px | 10 px | 18 px | 24 px |
| Bonus every | 8 s | 6.5 s | 5 s | 5 s |
| Combo window | 3.0 s | 3.0 s | 2.6 s | 2.2 s |

Values are linear between columns. `Glowcatch.difficulty(elapsed, 30, score)` returns them all, plus `phase` and `phaseIndex`.

### Phases

Crossing ⅓ and ⅔ of the pace changes the phase. `PhaseBanner` shows "Night falls" and then "Midnight" for `dur-phase`, and it never blocks a tap. Each phase also darkens the sky: `sky-deep` washes further down from the top, and more stars come out. The player sees that the game got harder before they feel it.

## Combo and the streak clock

- **Streak** counts catches in a row. Every catch, bonuses included, adds one.
- The multiplier is **×1** for streaks 1–4, **×2** from the 5th catch in a row, and **×3** from the 10th (`comboFor`).
- **The streak clock:** every catch refills it. It holds `dur-streak` (3 s) and shortens to 2.2 s at full pace. If it runs out with no catch, the streak is gone. A normal firefly fading out uncaught also ends the streak. Fading Lanterns, Frost and Swarm motes never do, so a missed bonus is never a punishment.
- The HUD shows it under the score: five pips that fill toward the next multiplier, the `×2 combo` chip (`lime`) or `×3 combo` chip (`glow`), and a thin bar that drains between catches. The bar turns `coral` in its last quarter and `frost` while the clock is frozen.
- **The sky follows the streak.** As the streak grows, a warm glow (`sky-warm`) rises from the horizon. It's full strength at 12 in a row. At ×3 a faint aurora band (`sky-aurora`) drifts across the sky. The heat rises in about 180 ms and cools over about 700 ms when the streak breaks, so losing it reads as the meadow going dark again. In High contrast both are off, and the chip, pips and bar carry the streak.
- Each catch plays a chime that climbs a pentatonic step with the streak. A new multiplier adds a brighter note and a `×2 combo` popup.

## Bonus fireflies

At most one bonus is on the field at a time, and the first one can't appear before 5 s. Each bonus differs in **shape** as well as colour, so none relies on colour alone.

| Bonus | Looks like | Lives | Effect | Weight |
|---|---|---|---|---|
| **Lantern** | Larger, whiter core, a turning dashed `glow` ring, pulsing halo | 1200 ms | +5 points, flat | 40 |
| **Frost** | `frost` body with six ice spokes turning slowly | 1300 ms | Stops the clock, the fading and the streak clock for `dur-freeze` (3 s). At most 2 per round | 35 |
| **Swarm** | `lime` body with three orbiting motes | 1300 ms | Releases six small, quick fireflies (0.6× size, 800 ms life) over `dur-swarm` | 25 |

- **While frozen:** the field takes a faint `frost-halo` tint with a frost vignette at the edges, the meadow and the fireflies stop moving, the moon and timer turn `frost` with a spinning snowflake, and "Frozen 3s" pops up. Spawning carries on, so a freeze is the moment to clear the field.
- Bonuses wander 1.6× more than normal fireflies, so they're a little harder to catch.
- Every catch shows a `FloatText` popup at the catch point: `+1` in `ink`, `+2` in `lime`, `+3` in `glow`, and `+5` large for a Lantern.

## Fireflies

- Scale diameters by `min(1.25, frameShortSide / 390)` × the pace's diameter value.
- Visible radius = start radius × life^0.7 (life goes 1 → 0): a firefly stays catchable for most of its life, then winks out.
- Spawn inside the safe field: below the HUD band (top 100 px + safe-area inset), above the meadow (bottom 12%), one diameter from the side edges, and clear of the fireflies already alive.

## Input and hit testing

- Listen to `pointerdown` on the play canvas, not `click`: it fires on touch-start and mouse-down, about 100 ms sooner. Set `touch-action: none` on the frame.
- Every pointer counts, so two thumbs can catch two fireflies at once.
- A tap hits when its distance from the centre is ≤ visible radius + `firefly-hit-slop`. If a tap hits two fireflies, it catches the one closer to fading.

## Feedback on a catch

1. The firefly leaves hit testing immediately.
2. Catch burst (`dur-burst`): an expanding ring of `glow-core` and sparks in the firefly's colour, drawn additively. Bonuses burst wider, with 12 sparks.
3. The score bumps (`ease-pop`), and a `FloatText` rises from the catch point.
4. Chime, plus `navigator.vibrate(8)` where supported.

## The clock

- The moon travels a dotted arc across the HUD. From 5 s left the moon and number turn `coral` and pulse — unless time is frozen, when frost wins.
- At zero: stop spawning, let live fireflies fade, then show game over. Taps after zero don't count.

## Pausing

- Pause on the HUD button, on Escape, on `visibilitychange` (hidden) and on `FBInstant.onPause`. Resume goes through a fresh 3-2-1. The clock, the freeze and the streak clock all hold while paused.

## Trust: keeping scores checkable

- The round's random numbers (spawn positions, bonus timing, bonus kind) come from a seeded generator. The seed arrives with the server's round token. The client sends its tap log (time, x, y) with the score.
- The server replays the round with that seed and the same `CURVE` / `BONUSES` / `comboFor`, then checks each tap against where a firefly actually was. A score the replay can't reproduce isn't ranked. The game-over notice reads "Score not ranked this round."
