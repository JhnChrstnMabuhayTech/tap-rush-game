# Brand book

> Snapshot of the Glowcatch design system, version `1792632918-1c3e` (2026-10-22). The design system is the source; see [README.md](README.md) for how to re-sync.

Glowcatch is Tap Rush, reimagined: thirty seconds of dusk in a meadow, and every circle is a firefly whose light is fading. Tap it before it goes dark. The core loop is untouched — a 30-second round, circles appear and shrink, a tap on one scores — and around it sit three things that make it Glowcatch: a pace that starts gentle and quickens as you score, a combo that multiplies points while you keep catching (and warms the sky while it lasts), and three bonus fireflies: Lantern (+5), Frost (stops the clock) and Swarm (a burst of quick fireflies). Everything is built to feel calm, warm and a little urgent, like trying to catch fireflies before your parents call you in. The rules are in the Gameplay section.

The game ships as a Facebook Instant Game to players worldwide, on phones first and desktop browsers second. Build every screen from this system: tokens for every value, the `Glowcatch` UI kit for every control, and the canvas helpers for the play field.

## Principles

- **The light is the UI.** The only bright things on screen are fireflies, the score and the button you should press next. Everything else stays in the night palette. If a new element glows, something else must stop glowing.
- **Readable in a glance.** A player looks at the HUD for a quarter of a second mid-round. Numbers are big, tabular and always in the same place.
- **Fair before flashy.** Hit areas are generous (`firefly-hit-slop`), fireflies drift slowly, and no effect ever covers a live target.
- **Calm, not sleepy.** Motion is soft (`ease-out`, `ease-pop`), sound is a pentatonic chime, and the only alarms are the moon turning `coral` in the last five seconds and the streak bar turning `coral` before it empties.

## Voice and copy

- Warm, short, second person. "Tap the fireflies before their light fades." Not "Tap circles to score points!"
- Sentence case everywhere: "Play again", "Tonight's brightest". The `label` style (SCORE, BEST, TIME) is the only uppercase.
- No exclamation marks except the countdown's "Go!". No emoji in UI copy.
- Say "score" and "points" for the number, "fireflies" for the things you tap: "Score 98", "Caught 61", "98 points in 30 seconds".
- Errors say what happened and what you keep: "Score not sent yet." + Retry; "Offline — your best is saved on this device." Never blame the player, never show codes.
- Write for translation: keep labels under 14 characters in English (German runs ~35% longer), avoid idioms in UI strings, and let numbers and icons carry meaning so a string can be dropped without breaking a screen. Full copy deck: the States section.

## Colour

- The ground is `sky`; the sky gradient on the play field runs `sky-deep` (top) to `sky` (70% down). Panels sit on `sky-raised`; hover and pressed fills use `sky-rise`.
- `glow` is the brand. Spend it on: fireflies, the live score, the final score, the primary button, the player's own leaderboard row (`glow` text on `glow-soft`), and the Best chip. Nothing else.
- Text is `ink` (moonlight cream) on `sky`, `sky-raised` or `sky-deep`; secondary text is `ink-muted` on the same grounds. Text on a `glow` fill is `on-glow`, never white.
- `lime` means *better than before*: New best, the ×2 combo chip and the Swarm bonus, always with words, on `lime-soft`. At ×3 the combo chip moves up to `glow`.
- `frost` means *time stopped*: the Frost firefly, the frozen moon and timer, the Frozen popup, on `frost-soft`. The field gets `frost-halo` as a faint tint and edge vignette.
- The sky reacts to play. Each phase darkens it with `sky-deep`; a growing streak warms the horizon with `sky-warm`, and ×3 adds a faint `sky-aurora` band. These are canvas washes, never behind text, and all are off in High contrast.
- `coral` means *running out* or *went wrong*: the last five seconds and error notices, always with a number or a sentence, on `coral-soft`.
- `meadow` and `meadow-tip` are scenery only; no text smaller than 24px sits on them.
- Dim the field with `scrim` behind the countdown and the game-over sheet so fireflies keep glowing faintly behind.
- Two themes. **Night** is the brand and the default. **High contrast** (`contrast`) is an added accessibility theme in Settings: pure black ground, AAA text, glows off, a solid `firefly-ring` around every firefly and `line-strong` borders on every panel, chip and notice. Switch by setting `data-theme="contrast"` on `<html>`; canvas helpers read tokens at draw time, so the field follows.

Every text token holds 4.5:1 or more on the grounds its note names, in both themes (Night: `ink` on `sky` 15:1, `ink-muted` on `sky-raised` 6.6:1, `glow` on `sky-raised` 9:1, `coral` on `sky-raised` 6:1). `line` is decorative (1.8:1); anything that carries meaning uses `line-strong` (3.9:1 on `sky-raised`).

## Type

- One family: **Bricolage Grotesque** (variable, 200–800, optical size 12–96) — friendly ink-trap grotesque with personality at display sizes and clean numerals at HUD sizes. In the game, self-host a Latin + Latin-Extended woff2 subset (target under 40 KB) and preload it before `FBInstant.startGameAsync`; the system stack covers CJK, Thai, Arabic and Devanagari names on the leaderboard.
- Set the game name in `title`, the final score in `score-xl`, the countdown in `countdown`, the live score in `score-hud`, panel titles in `heading`.
- Buttons use `button`, copy uses `body`, small caps-style labels over numbers use `label`, leaderboard rows use `row`.
- Every number on screen is tabular (`.gc-num`, `font-variant-numeric: tabular-nums`) so the score never jitters as it climbs.

## Space, shape, depth

- Spacing is a 4px scale: `space-4` is the phone inset and panel padding, `space-6` the desktop panel padding and stack gap, `space-8` between the score block and actions. Add `env(safe-area-inset-*)` on top of HUD insets.
- Everything you press is a pill (`radius-pill`); icon buttons are `radius-md`; panels and the share card are `radius-lg`; rows and notices `radius-sm`. No sharp corners anywhere.
- Light comes from the fireflies, not from above: use `glow-sm` / `glow-lg` instead of drop shadows. The only real shadow is `panel`, under the game-over sheet. High contrast turns all three off.
- Every tap target is at least `tap-min` (48px). Fireflies start at `firefly-start` (72px on a 390px-wide frame, scaled by the frame's short side) and are hit-tested with `firefly-hit-slop` extra radius.

## Layout: phone and desktop

- **Phone (portrait):** the play frame is the whole viewport. HUD across the top (score left, moon timer centre, pause right), meadow along the bottom 12%. Fireflies spawn between the HUD band and the meadow.
- **Phone (landscape):** same frame; the HUD keeps its order, fireflies use the wider field. No rotate-your-phone gate.
- **Desktop:** a 9:16 play frame up to `frame-max` (540px) wide, centred and letterboxed on `sky-deep` (`.gc-letterbox`). Mouse and touch go through the same `pointerdown` handler. Sheets cap at `panel-max` (420px).
- Never put an interactive element in the bottom 12% during play — that is where thumbs rest and where Facebook's own overlay can appear on some clients.

## Motion and sound

- Durations: `dur-tap` (press, catch flash), `dur-burst` (catch burst, score bump), `dur-sheet` (game-over sheet rising), `dur-count` (each countdown step), `dur-life` (a firefly's lifetime), `dur-title` (the title intro), `dur-float` (score popups), `dur-phase` (phase banner), `dur-streak` (the combo clock), `dur-freeze` and `dur-swarm` (bonus effects).
- The title is the one place motion is showy: "Glow" rises letter by letter, then "catch" lights up one letter at a time with a flicker, like fireflies switching on, and settles into a slow breathing glow with a wave running through it. One small firefly loops around the name, and the Play button breathes between `glow-sm` and `glow-lg` to invite the first tap. The rest of the screen follows once the name has landed (about 1.1 s). Play works from the first frame, so nobody has to wait for the intro.
- Easing: `ease-out` for arrivals, `ease-pop` for rewards, `ease-fade` for a firefly's shrink.
- Under `prefers-reduced-motion`, drop every decorative animation to none — the bundle does this: the title appears fully lit, popups and banners appear without moving — but keep the firefly shrink, the freeze and the streak clock, which are gameplay.
- Sound unlocks on the player's first tap (browsers block audio before that); the Sound toggle is remembered per player. Each catch plays a soft chime that climbs a pentatonic scale with the streak; the last five seconds add a quiet tick. Haptics: `navigator.vibrate(8)` on catch where supported.

## Iconography

Thirteen original 24×24 stroke icons, 2.25px, round caps — see the Icons asset group. In code use `Glowcatch.Icon(name)` so icons take `currentColor`. Icons always sit beside a word, except Pause and Sound, which are icon buttons with an `aria-label`.

## Building with the kit

- Load `tokens.css`, `components/bundle.css` and `components/bundle.js`; `window.Glowcatch` holds every component. Components are plain functions `(props) => HTMLElement` — no framework, so the Instant Game bundle stays small and boots fast.
- Stateful components return an element with `update(next)`: call `hud.update({ score, timeLeft, streak, streakLeft, frozen })` from the game loop.
- Read the round's numbers from `Glowcatch.difficulty(elapsed, 30, score)`, `Glowcatch.comboFor(streak)`, `Glowcatch.pointsFor(kind, streak)` and `Glowcatch.BONUSES`. The PlayField demo is the reference loop that uses them.
- Draw the play field with `Glowcatch.drawField` and each firefly with `Glowcatch.drawFirefly` on one full-frame canvas; keep the HUD and sheets as DOM above it (`z-hud`, `z-scrim`, `z-sheet`, `z-notice`).
- Make the share image with `Glowcatch.renderShareImage({ score, name })` and pass `canvas.toDataURL('image/png')` to `FBInstant.shareAsync`.

## Accessibility

- Contrast: see Colour; the `contrast` theme is the AAA option.
- Keyboard (desktop): Space or Enter starts and restarts; Escape pauses; focus is a solid 3px `focus-ring` with a 2px offset on every control.
- Status is never colour alone: New best has a word and a spark, the combo has a chip, pips and a bar, each bonus firefly has its own shape, frozen time shows a snowflake, the last seconds show the number, and errors are sentences.
- Screen readers get the score on game over via `aria-live="polite"`; the live HUD stays silent during play so it does not chatter.
