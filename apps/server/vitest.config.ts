import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineProject } from 'vitest/config';

// Tests run inside the Workers runtime (workerd) with a local D1 database,
// emptied and migrated from migrations/ before each test (src/test/setup.ts).
export default defineProject(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: {
        bindings: {
          APP_SECRET: 'test-app-secret',
          TEST_MIGRATIONS: await readD1Migrations(
            fileURLToPath(new URL('./migrations', import.meta.url)),
          ),
        },
      },
    }),
  ],
  test: { name: 'server', setupFiles: ['./src/test/setup.ts'] },
}));
