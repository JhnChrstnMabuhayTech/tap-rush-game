import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Math functions whose results the spec leaves to the engine: approximated (they
// can differ in the last bit between Facebook's webviews and the server) or random.
// sqrt, floor, round, abs, min, max and imul are exact everywhere.
const ENGINE_DEPENDENT_MATH = (
  'sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh atanh ' +
  'exp expm1 log log1p log2 log10 pow cbrt hypot random'
).split(' ');
const REPLAY_SAFE = 'The server replays rounds bit for bit (docs/architecture.md).';

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
  {
    // The simulation must replay identically everywhere: no engine-dependent maths,
    // no clock, no randomness but the seeded generator. Tests may compare against these.
    files: ['packages/shared/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...ENGINE_DEPENDENT_MATH.map((property) => ({
          object: 'Math',
          property,
          message: `Use plain arithmetic or curves.ts. ${REPLAY_SAFE}`,
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**'], AssignmentExpression[operator='**=']",
          message: `** may round differently between engines; multiply instead. ${REPLAY_SAFE}`,
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'Date', message: `Simulation time comes from ticks. ${REPLAY_SAFE}` },
        { name: 'performance', message: `Simulation time comes from ticks. ${REPLAY_SAFE}` },
        { name: 'crypto', message: `Randomness comes from the seeded generator. ${REPLAY_SAFE}` },
      ],
    },
  },
  prettier,
);
