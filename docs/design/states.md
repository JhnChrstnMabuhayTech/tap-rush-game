# Screens, states and copy

> Snapshot of the Glowcatch design system, version `1792632918-1c3e` (2026-10-22). The design system is the source; see [README.md](README.md) for how to re-sync.

Every screen the game can be in, and what it shows when things do not go to plan.

## Flow

1. **Boot** — Facebook's own loader. Report real progress with `FBInstant.setLoadingProgress` while the font, sounds and bundle load; call `startGameAsync` only when the title screen can render.
2. **Title** (`TitleScreen` over a `PlayField` with `ambient: true`) — the name animates in (Glow rises, catch lights up letter by letter), then Play, Leaderboard, and the Best chip when the player has a best. The intro plays every time the title appears.
3. **How to play** (before the first round only; afterwards it lives in Settings) — `BonusLegend` in a panel with a "Got it" primary button. It's shown before the first countdown, once.
4. **Countdown** (`Countdown` on `scrim`) — 3, 2, 1, Go!. The round token and seed are requested from the server during this.
5. **Play** (`PlayField` + `ScoreHud`). The round opens slowly, then the `PhaseBanner` marks "Night falls" and "Midnight" as pace rises (see Gameplay).
6. **Paused** — `scrim`, "Paused", Resume (primary) and Quit round (ghost). Resume returns through Countdown.
7. **Game over** (`GameOver` sheet rising over the dimmed field) — score, Best, Rank, top Combo, fireflies Caught, New best chip, Share, Play again, top-10 `Leaderboard`.
8. **Leaderboard** (from Title) — the same `Leaderboard` in a full sheet with a Close icon button.

Play again goes straight to Countdown: one tap from the end of a round to the start of the next.

## Best score

- Show the best the moment the title renders: read it from `localStorage` first (instant), then reconcile with `FBInstant.player.getDataAsync(['best'])` and keep the higher of the two.
- On game over, if `score > best`: update the screen first, then write to `localStorage` and `FBInstant.player.setDataAsync`. A failed cloud write is retried on the next launch; it never blocks the screen.
- First session: no Best chip on the title, and Best shows the new score with a New best chip on the first game over. Never show "Best 0".

## Edge cases

| Situation | What the player sees |
|---|---|
| Leaderboard loading | Five `gc-skel` rows; the rest of game over is already usable. |
| Leaderboard empty | "No catches yet tonight" / "Be the first light on the board." |
| Player outside the top 10 | Top 10, a `•••` gap, then the player's row pinned in `glow-soft` with their true rank. |
| Player inside the top 10 | Their row highlighted in place; no pinned row. |
| Ties | Same score, same rank number; earlier score lists first. |
| Score submit failed | Error `Notice`: "Score not sent yet." + Retry. Best is still saved locally. Retry is also attempted automatically on the next round. |
| Offline | Offline `Notice`: "Offline — your best is saved on this device." Leaderboard shows the offline notice with Retry. Play is never blocked. |
| Round token unavailable | The round still plays; the score is kept locally and the game-over notice says "Score not ranked this round." |
| Score rejected by server | Same as unavailable — no accusation, no error code. |
| Share cancelled | Nothing. Cancelling is not an error. |
| Share unavailable / failed | The Share button returns from busy; a quiet info `Notice` "Couldn't open sharing." for 3 s. |
| Long or non-Latin names | Truncate with an ellipsis at one line; the system font stack renders the script. |
| Missing profile photo | Initials on a `sky-rise` disc. |
| Tab hidden / app backgrounded | Auto-pause (see Gameplay). |
| Window resized mid-round | Re-measure the frame; live fireflies keep their relative positions. |
| Paused while frozen | The freeze, the streak clock and the round clock all hold; resume picks up exactly where it left off. |
| Bonus fades uncaught | Nothing — no streak loss, no sound. |
| Streak clock runs out | Pips, chip and bar clear; the warm sky cools over ~700 ms. No sound, no message. |
| Third Frost in a round | Never spawns; the bonus is re-rolled from Lantern and Swarm. |

## Copy deck

| Key | English | Notes |
|---|---|---|
| title.tagline | Thirty seconds of dusk. Tap the fireflies before their light fades. | ≤ 2 lines at 300px |
| title.play | Play | |
| title.leaderboard | Leaderboard | |
| chip.best | Best {n} | |
| hud.score | Score | `label` style |
| hud.combo | ×{n} combo | lime at ×2, glow at ×3 |
| float.points | +{n} | catch popup |
| float.frozen | Frozen 3s | with the frost icon |
| float.swarm | Swarm | |
| phase.night | Night falls | step "Phase 2 of 3", hint "Faster and smaller" |
| phase.midnight | Midnight | step "Phase 3 of 3", hint "Last stretch" |
| howto.title | How to play | |
| howto.firefly | Firefly — 1 point, times your combo | |
| howto.lantern | Lantern — +5 points | |
| howto.frost | Frost — Stops the clock for 3s | |
| howto.swarm | Swarm — Six quick fireflies | |
| howto.combo | Catch 5 in a row to double every catch, 10 to triple it. Let one fade and the combo resets. | |
| howto.ok | Got it | |
| countdown.ready | Get ready | under the 3 |
| countdown.go | Go! | the only exclamation mark |
| pause.title | Paused | |
| pause.resume | Resume | |
| pause.quit | Quit round | |
| over.score | Score | over the score |
| over.combo | Combo | top multiplier, `×3` |
| over.caught | Caught | fireflies caught |
| over.best | Best | |
| over.rank | Rank | `—` when unknown |
| over.newBest | New best | lime chip |
| over.share | Share | |
| over.again | Play again | |
| board.title | Tonight's brightest | |
| board.scope | Top 10 | |
| board.empty.title | No catches yet tonight | |
| board.empty.body | Be the first light on the board. | |
| notice.submitFailed | Score not sent yet. | + Retry |
| notice.offline | Offline — your best is saved on this device. | |
| notice.unranked | Score not ranked this round. | |
| notice.shareFailed | Couldn't open sharing. | |
| share.text | I scored {n} in 30 seconds of Glowcatch. Can you beat it? | `shareAsync` text |
