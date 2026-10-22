# Components

> Snapshot of the Glowcatch design system, version `1792632918-1c3e` (2026-10-22). The design system is the source; see [README.md](README.md) for how to re-sync.

Guidelines for every component in the Glowcatch UI kit (`window.Glowcatch`). Components are plain functions `(props) => HTMLElement`; the typed API arrives with the kit in `apps/game`.

## TitleScreen

The first screen: an animated wordmark, one line of invitation, the Best chip for returning players, Play and Leaderboard.

- **Provide:** `best` (hidden when 0 or missing), `onPlay`, `onLeaderboard`; optional `tagline` and `playLabel` for localisation; `still: true` renders it without the intro (docs, screenshots).
- **The intro (`dur-title`, about 1.4 s):** "Glow" rises letter by letter (`ease-out`, 60 ms stagger). "catch" then lights up one letter at a time with a quick flicker, like fireflies switching on, and settles into a slow breathing glow. A wave of light and a 3 px bob run through it, out of step from letter to letter. A single small firefly loops around the name. The tagline, Best chip and buttons follow at 0.9–1.1 s, and the Play button then breathes between `glow-sm` and `glow-lg`.
- Play is clickable from the first frame — the intro never gates input. It replays every time the title is shown, and under reduced motion the name appears fully lit.
- The letters are `aria-hidden` spans; the `h1` carries `aria-label="Glowcatch"` so screen readers hear one word.
- Lay it over a `PlayField` with `ambient: true` (fewer, smaller, dimmer fireflies), so the game is already alive behind the menu.

## BonusLegend

How to play in one panel: the normal firefly and the three bonuses drawn live with what each does, then the combo rule.

- **Provide:** nothing required; `title` overrides "How to play", and `title: null` hides it. Place it in a `.gc-panel` with a "Got it" primary button below.
- Show it once, before the first round of a player's first session, and keep it in Settings after that.
- The fireflies are the real `Firefly` drawings, so the legend always matches the field. Effect copy comes from `Glowcatch.BONUSES`.
- Two columns, collapsing to one under 360 px.

## Countdown

The 3-2-1-Go! that opens every round and every resume, full-frame on `scrim`.

- **Provide:** `value` (3, 2, 1, or 0 for "Go!") and an optional `hint` ("Get ready" under the 3). Replace the element each step, every `dur-count`.
- Numerals are `countdown` in `ink`; "Go!" is `glow`. `still: true` skips the zoom (docs, reduced motion).
- Request the server round token while the countdown runs so the round starts without a wait.

## PlayField

The whole play frame: a full-bleed canvas with the sky, stars and meadow, the fireflies, an effects layer for popups and banners, the `ScoreHud`, and an optional layer on `scrim`.

- With `demo` on (the default) it runs a **real round** — the reference implementation of Gameplay. The pace starts slow and quickens with score through Dusk, Night falls and Midnight. It handles combos with the streak clock, Lantern, Frost and Swarm bonuses, popups, phase banners, the sky warming with the streak, and a loop back to a fresh round after 30 s. Tap the preview to play it.
- **Provide:** `score`, `streak`, `elapsed` (seconds to start at) or `timeLeft`, `frozen`, `demo`, `ambient` (title backdrop: three dim fireflies, no HUD, no clock), `clock` (force the round on or off), `loop`, and `layer` (an element shown over the scrim, such as `Countdown` or `GameOver`; a layer turns the clock off).
- In the game, keep the same structure — `.gc-frame` holding the canvas, `.gc-fx`, the HUD and `.gc-layer` — and drive it from your own loop with `difficulty`, `comboFor`, `pointsFor`, `BONUSES`, `drawField` (pass `phase`, `frozen`, `heat`, `hot`) and `drawFirefly`. Use a seeded generator so the server can replay the round.
- `el.spawn(kind)` drops a firefly of a kind into the field (docs and tests).
- On desktop wrap the frame in `.gc-letterbox` for a 9:16 frame up to `frame-max`, centred on `sky-deep`. The frame sets `touch-action: none`, so fast taps never scroll, zoom or select.

## ScoreHud

The in-round heads-up display: the live score and the combo on the left, the moon timer in the centre, Pause on the right.

- **Provide:** `score`, `timeLeft` (seconds, may be fractional), `streak`, `streakLeft` (0 → 1, the share of the combo clock remaining), `frozen` (ms of freeze left, 0 when not frozen), optional `total` (30), `lowAt` (5) and `onPause`. Call `hud.update({...})` from the game loop; it only touches the DOM when a value changes.
- **Combo:** from the first catch in a row, five pips fill toward the next multiplier. From ×2 a `×2 combo` chip (`lime`) appears, popping in, and at ×3 it becomes `×3 combo` (`glow`) with full glowing pips. Under them, the **streak bar** drains between catches: `lime` (or `glow` at ×3), `coral` in its last quarter, `frost` while frozen. When it empties, everything clears.
- **Frozen:** the moon, the travelled arc and the number turn `frost`, and a snowflake spins beside the seconds. Frost wins over the coral last-five-seconds state.
- The score is `score-hud` in `glow`, tabular, and bumps on every increase.
- Place it as the first layer above the canvas (`z-hud`), with the safe-area inset added to its top padding. It's `aria-live="off"` during play.

## Firefly

The target: a glowing disc that shrinks as its light fades, with a soft halo, faint beating wings and a catch burst — plus the three bonus kinds.

- In the game, draw fireflies on the play canvas with `Glowcatch.drawFirefly(ctx, { x, y, r, life, caught, seed, kind }, now)`. The `Firefly` element is the same drawing on its own canvas, for docs and the How to play legend.
- **Provide:** `diameter` (start size), `kind` (`normal` · `lantern` · `frost` · `swarm`), `life` (1 → 0) or `caught` (0 → 1 burst progress); `animate: true` loops spawn → shrink → catch.
- **Every kind has its own shape, not just a colour:** a Lantern is 1.25× larger with a whiter core, a turning dashed ring and a pulsing halo; Frost is `frost` with six ice spokes; Swarm is `lime` with three orbiting motes. Effects and numbers: the Gameplay section.
- Pass `now = 0` while time is frozen so the rings, spokes and motes hold still with everything else.
- The visible disc is the hit area (plus `firefly-hit-slop`); halos, rings and motes are decoration.
- In the `contrast` theme halos are off and `firefly-ring` draws a solid ring; the bonus shapes still show.

## FloatText

A popup that rises and fades from where something was caught: `+1`, `+2`, `+3`, `+5`, `×2 combo`, `Frozen 3s`, `Swarm`.

- **Provide:** `text`, `tone` (`ink` · `lime` · `glow` · `frost`), `x` and `y` in px within the frame, optional `icon` and `big`, and `parent` (the frame's `.gc-fx` layer) to append it. It removes itself after `dur-float`.
- Tone follows the multiplier: `+1` `ink`, `+2` `lime`, `+3` `glow`. A Lantern's `+5` is `big` `glow`; `Frozen 3s` is `big` `frost` with the frost icon, placed at 30% of the frame's height, not over the HUD.
- One popup per catch, plus one more when the multiplier goes up. Never put a popup over the HUD.
- Under reduced motion it appears in place and fades out without moving.

## PhaseBanner

The short banner that marks the round getting harder: "Night falls" at ⅓ pace, "Midnight" at ⅔.

- **Provide:** `name`, `step` ("Phase 2 of 3"), `hint` ("Faster and smaller", "Last stretch") and `parent` (the `.gc-fx` layer). It shows for `dur-phase` and removes itself; `still: true` keeps it static for docs.
- It sits at 30% of the frame's height, never takes pointer events, and never covers the HUD. Fireflies under it stay catchable.
- It uses `role="status"`, so screen readers hear the change once.

## GameOver

The end-of-round sheet: the score, Best, Rank, top Combo and fireflies Caught, a New best chip when earned, Share and Play again, then the top-10 leaderboard.

- **Provide:** `score`, `best` (already including this round), `isNewBest`, `rank` when the server returns one, `topCombo` (highest multiplier reached, shown as `×3`), `caught` (fireflies caught), `submit` (`sending` · `sent` · `failed` · `offline`), `sharing`, `leaderboard` (props for `Leaderboard`), and the `onShare`, `onPlayAgain`, `onRetrySubmit` handlers.
- Show it immediately with the local result; the rank and leaderboard fill in when the server answers. Never hold the score behind a network call.
- Play again is primary and on the right (the thumb side); Share is secondary.
- The score is announced once via `aria-live="polite"`.
- It rises from the meadow over `dur-sheet` and sits in a `.gc-layer` on `scrim`.

## Leaderboard

The top 10, ranked by the server, with the player's own row highlighted in place or pinned underneath when they're outside the top 10.

- **Provide:** `state` (`ready` · `loading` · `empty` · `error` · `offline`), `entries` (up to 10 `{ rank, name, score, photo?, isPlayer? }`), optional `playerEntry` for the pinned row, `onRetry`, and `title` / `scope` / `hideHeader`.
- Ranks 1–3 are `glow`; the player's row is `glow` text on `glow-soft` and says "(you)".
- Photos come from the server's copy of `FBInstant.player.getPhoto()`; missing or broken photos fall back to initials.
- Names truncate to one line; never wrap a row.
- Rows stagger in (30 ms apart) on first render only.

## ShareCard

The 1200×630 image a player shares: their score huge in `glow`, "fireflies in 30 seconds", a few fireflies and the meadow, and the game name with "Can you beat it?".

- Generate it at share time with `Glowcatch.renderShareImage({ score, name })` and pass `canvas.toDataURL('image/png')` as `image` to `FBInstant.shareAsync({ intent: 'SHARE', image, text, data: { score } })`. `ShareCard` is the same canvas as a preview element.
- Wait for the font (`document.fonts.load`) before drawing, or the numerals fall back to the system face.
- Keep the score and the game name inside the left 55%: Facebook crops share images differently per surface.

## Notice

One line that says what happened and what the player keeps: an error with Retry, an offline note, or a gentle tip.

- **Provide:** `message`, a `tone` (`error` · `offline` · `info`) and optionally `actionLabel` + `onAction`.
- Error notices use `role="alert"`; the others `role="status"`.
- Inside a sheet, place it directly above the actions. Over the play field, pin it under the HUD at `z-notice`.
- Never show error codes or blame; copy lives in the States section.

## Button

The pill you press: primary (glow) for the one thing the screen is for, secondary (outlined) beside it, ghost for a quiet third option, iconOnly for Pause and Sound.

- **Provide:** `label` (always — it becomes the `aria-label` on icon buttons), optional `icon`, `onClick`.
- One `primary` per screen: Play on the title, Play again on game over, Resume when paused.
- `size: 'lg'` only for the title screen's Play. `block` fills the column on narrow sheets.
- Set `busy: true` while `FBInstant.shareAsync` is pending; it disables the button and shows a spinner in the label's place.
- Use `pressed` for toggles (Sound), which sets `aria-pressed`.
- Labels are sentence case, verb first, one or two words: "Play again", not "PLAY AGAIN!".
- Don't put a button in the bottom 12% of the play field during a round.

## Chip

A small pill of status beside a number: Best, New best, combo, frozen, time left, rank.

- **Provide:** `label`, a `tone` and optionally an `icon`; `pop: true` animates it in with `ease-pop` the first time it appears.
- `glow` for Best (with `trophy`) and the ×3 combo, `lime` for New best and the ×2 combo (with `spark`), `frost` for frozen time (with `frost`), `coral` only for time running out, `neutral` for rank and everything else.
- Always words or a number inside — never a coloured dot alone.

## Icon

Thirteen 24×24 stroke icons drawn in `currentColor`, so they take the colour of the button or chip they sit in.

- **Provide:** a `name` (`play`, `replay`, `share`, `trophy`, `pause`, `sound-on`, `sound-off`, `close`, `spark`, `frost`, `offline`, `alert`, `settings`); `Icon('share')` works too.
- Pair every icon with a word, except inside an iconOnly `Button` (which carries an `aria-label`).
- Icons are `aria-hidden`; never use one as the only carrier of meaning.
