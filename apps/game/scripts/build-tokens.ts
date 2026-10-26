// Regenerates src/kit/tokens.css from src/kit/tokens.json: `pnpm tokens`.
import { readFileSync, writeFileSync } from 'node:fs';
import { tokensToCss } from './tokens-css.ts';

const kit = new URL('../src/kit/', import.meta.url);
const tokens = JSON.parse(readFileSync(new URL('tokens.json', kit), 'utf8'));

writeFileSync(new URL('tokens.css', kit), tokensToCss(tokens));
console.log('Wrote src/kit/tokens.css');
