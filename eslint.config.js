import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    '**/dist/',
    '**/coverage/',
    '**/.wrangler/',
    // Vendored from the Glowcatch design system; kept byte-identical to the source.
    'apps/game/src/kit/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    files: ['apps/game/src/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.config.{js,ts}', '**/scripts/**'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
