# Commands

Run from the repo root.

## Whole workspace
- `pnpm install` (CI: `pnpm install --frozen-lockfile`)
- `pnpm check` — lint + format check + typecheck + tests (all of CI except build)
- `pnpm lint` · `pnpm format` (writes) · `pnpm format:check` · `pnpm typecheck` (tsc per package) · `pnpm test` (Vitest, all projects) · `pnpm test:watch` · `pnpm build` (game build + Worker dry-run bundle)
- One Vitest project: `pnpm vitest run --project <game|server|shared>`

## Game (`--filter @glowcatch/game`)
- `dev` → http://localhost:5173 with the local SDK stand-in; `dev:fb` → HTTPS (self-signed) for Facebook's embedded player at `https://www.facebook.com/embed/instantgames/<APP_ID>/player?game_url=https://localhost:5173`
- `build` → `apps/game/dist`; `bundle` → build + `apps/game/release/glowcatch-<sha>[-dirty].zip` for Web Hosting
- `tokens` → regenerate `src/kit/tokens.css` from `src/kit/tokens.json`
- URL override: `?platform=local|facebook`

## Server (`--filter @glowcatch/server`)
- `dev` → http://localhost:8787 (`/health`); `build` → `wrangler deploy --dry-run --outdir dist`; `deploy` (needs `wrangler login`)

## Windows specifics (this machine)
- Both Git Bash (POSIX) and PowerShell 5.1 (no `&&`; chain with `;` / `if ($?)`) are available. The repo path contains a space (`Work Files`): always quote it.
- Node 24 runs `.ts` files directly (type stripping): scripts under `apps/game/scripts/` import siblings with explicit `.ts` extensions (`allowImportingTsExtensions` in `tsconfig.node.json`).
- `core.autocrlf=true` here but `.gitattributes` forces LF; files rewritten by tools should be written with LF.
- Bash heredocs passed through the agent shell can mangle `\'` and `\\`; write multi-line scripts to a scratch file and run that instead.
- Visual checks: headless Chrome (`C:/Program Files/Google/Chrome/Application/chrome.exe`) `--screenshot` is unreliable (min window width ~500 px, CSS animations don't advance in virtual time). Drive it over the DevTools protocol with `Emulation.setDeviceMetricsOverride` (mobile 390×844, touch emulation via `Input.dispatchTouchEvent`) and real waits; in dev builds, `window.glowcatch.current().round` gives firefly positions to tap.
- The agent shell can have `NODE_ENV=production` set (not at user or machine level). Vite derives `import.meta.env.DEV` from it, so a dev server started there serves `DEV: false` and the dev hook is missing. Start it as `NODE_ENV=development pnpm --filter @glowcatch/game dev`.
- Stopping a backgrounded `vite` task can leave the node process holding its port: find it with `netstat -ano | grep :<port>`, confirm its command line, then end that PID.
