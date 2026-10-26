// What tests see as `env` (from "cloudflare:workers"): the Worker's bindings,
// plus the migrations vitest.config.ts reads for src/test/setup.ts.
import type { D1Migration } from 'cloudflare:test';
import type { Env as WorkerEnv } from '../env';

declare global {
  namespace Cloudflare {
    interface Env extends WorkerEnv {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
