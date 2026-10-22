# Design assets

> Snapshot of the Glowcatch design system, version `1792632918-1c3e` (2026-10-22). The design system is the source; see [README.md](../README.md) for how to re-sync.

## Logos

- `glowcatch-mark.svg` — The mark: one firefly and its trail of three fading dots. Full colour (glow, glow-core); use on `sky` or `sky-deep` only.
- `glowcatch-app-icon.svg` — 1024×1024 app icon for the Facebook app dashboard and the Instant Games listing. Export to PNG at 1024 for upload. Keep the firefly inside the centre 80% so Facebook's circular crop never cuts it.

The wordmark is type, not an image: "Glow" in `ink` + "catch" in `glow`, set in the `title` style (Bricolage Grotesque 800).

## Icons

Thirteen 24×24 stroke icons: 2.25px stroke, round caps and joins, drawn for Glowcatch. These files are drawn in `glow` (#ffc94a) so they read in an `<img>` on any tile. In the game use `Glowcatch.Icon(name)` instead: the same paths in `currentColor`, coloured by the button they sit in.

- `play.svg` — Start a round (title screen). The only filled glyph.
- `replay.svg` — Play again.
- `share.svg` — Share the score image.
- `trophy.svg` — Leaderboard and the Best chip.
- `pause.svg` — Pause during a round.
- `sound-on.svg`, `sound-off.svg` — The sound toggle.
- `close.svg` — Close a sheet.
- `spark.svg` — New best, streak, tips.
- `frost.svg` — Frozen time: the HUD timer while Frost is active, the Frozen popup and chip.
- `offline.svg` — Offline notice.
- `alert.svg` — Error notice.
- `settings.svg` — Settings (theme, sound, reduced motion).

Only the logos are copied here. The icons ship inline in the UI kit (`Glowcatch.Icon(name)`), so the game needs no icon files.
