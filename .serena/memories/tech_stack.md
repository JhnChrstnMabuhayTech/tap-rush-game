# Tech stack and version pins

- Node >= 22.12 (`.nvmrc`: 24). pnpm 11 workspaces (`pnpm-workspace.yaml`: `apps/*`, `packages/*`); `packageManager` pins pnpm in root `package.json`.
- pnpm 11 policies, kept on deliberately (decision D12):
  - `allowBuilds` in `pnpm-workspace.yaml`: only `workerd` and `esbuild` may run install scripts. A new dep with a postinstall fails install until listed.
  - `minimumReleaseAge` (default 1 day): a version published < 24 h ago fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`, also when an existing lockfile entry is too new. Pick an older version; don't add `minimumReleaseAgeExclude` entries (pnpm adds one automatically on `pnpm add` — remove it).
- TypeScript `~6.0` — not 7.x: typescript-eslint 8 supports TS < 6.1.
- Vitest `^4.1`. The pin came from `@cloudflare/vitest-pool-workers` (4.1 only); the server now uses its renamed successor `@cloudflare/vitest-plugin` (`cloudflareTest()` in `apps/server/vitest.config.ts`), which supports 4.1 and 5, so a Vitest 5 upgrade is possible as its own change. Don't add `vitest-pool-workers`: it's deprecated.
- ESLint 10 flat config + typescript-eslint `recommended` + eslint-config-prettier; Prettier 3.
- Game: Vite 8 (Rolldown), `@vitejs/plugin-basic-ssl` (only in `--mode fb`), `fflate` (release zip). `build.cssMinify: false` on purpose: the kit reads design tokens at runtime (durations via parseFloat as ms, colours via a 6-hex/rgba parser) and a minifier rewrites them (`800ms`→`.8s`). `scripts/check-build.ts` (run by `build`/`bundle`) fails if any token in dist CSS differs from `src/kit/tokens.css`. Read duration tokens with `durationMs()` (`src/ui/duration.ts`), never bare parseFloat. Facebook Instant Games SDK 8.0 is a script tag from `connect.facebook.net`, not an npm package; its types are hand-written in `apps/game/src/platform/fbinstant.ts`.
- Server: Wrangler 4, `@cloudflare/workers-types` and `@cloudflare/vitest-plugin/types` (via tsconfig `types`), `compatibility_date` in `apps/server/wrangler.jsonc`. D1 binding `DB` (database `glowcatch`, schema in `apps/server/migrations/`); no `database_id` until the first deploy creates the database.
- Workspace packages are consumed as TypeScript source (`exports` → `./src/index.ts`); there is no package build step. Vite and Wrangler compile them with the app.
- `tsconfig.base.json`: strict, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `moduleResolution: Bundler`, `noEmit`, `types: []` (each package opts into DOM / Workers / Node types).
