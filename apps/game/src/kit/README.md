# Glowcatch UI kit (vendored)

The components, canvas helpers and tokens from the Glowcatch design system, copied in unchanged so the game can be built without access to it.

| File | What it is |
| --- | --- |
| `bundle.js` | Every component on `window.Glowcatch`: plain functions `(props) => HTMLElement`, plus `drawField`, `drawFirefly`, `renderShareImage` |
| `bundle.css` | Component styles (`gc-` classes) |
| `index.d.ts` | Types for `window.Glowcatch` |
| `tokens.json` | Every design token, identical to [`docs/design/tokens.json`](../../../../docs/design/tokens.json) |
| `tokens.css` | **Generated** from `tokens.json` by `pnpm tokens`; don't edit it |

**Source:** design system version `1792976353-f6e9`, copied 2026-10-26. Its content matches the `1792632918-1c3e` snapshot in `docs/design`.

## Rules

- Don't edit `bundle.js`, `bundle.css` or `index.d.ts` here. Fix the design system and re-copy, so the two never drift apart.
- The game imports the kit through `src/ui/kit.ts`, never these files directly.
- The round's rules (pace, combo, bonuses) are read from `@glowcatch/shared`, not from the kit's copies, because the server must run the same code.

## Re-syncing

1. Copy `components/bundle.js`, `components/bundle.css`, `components/index.d.ts` and `tokens.json` from the design system into this folder.
2. Copy `tokens.json` to `docs/design/tokens.json` too, and re-sync the rest of the snapshot (see [`docs/design/README.md`](../../../../docs/design/README.md)).
3. Run `pnpm --filter @glowcatch/game tokens`, then `pnpm test`. The tests fail if `tokens.css` is stale, if the two `tokens.json` copies differ, or if the stylesheet reads a token that doesn't exist.
4. Update the source version above.

## Known gaps

- `bundle.css` starts with an `@import` of Bricolage Grotesque from Google Fonts. The design calls for a self-hosted woff2 subset instead (review note G4), and an Instant Game may only reach domains on its Content Security Policy. Until the font is self-hosted, Facebook may block that request, and the game would fall back to the system font.
