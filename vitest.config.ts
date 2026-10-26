import { defineConfig } from 'vitest/config';

// One test run across the workspace: each app and package is a Vitest project
// with its own config (environment, setup), reported together.
export default defineConfig({
  test: {
    projects: ['apps/*', 'packages/*'],
    passWithNoTests: true,
  },
});
