import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { tokensToCss, type TokensFile } from './tokens-css.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const kitTokens: TokensFile = JSON.parse(read('../src/kit/tokens.json'));
const css = tokensToCss(kitTokens);

describe('tokens.css', () => {
  it('is up to date with tokens.json (run `pnpm tokens` if not)', () => {
    expect(read('../src/kit/tokens.css')).toBe(css);
  });

  it('defines every custom property the kit stylesheet reads', () => {
    const used = new Set(
      [...read('../src/kit/bundle.css').matchAll(/var\(--([\w-]+)/g)].map((match) => match[1]),
    );
    used.delete('i'); // the kit's own per-letter index, set inline
    const missing = [...used].filter((name) => !css.includes(`  --${name}: `));
    expect(missing).toEqual([]);
  });

  it('puts Night on :root and overrides only what High contrast changes', () => {
    const [root = '', contrast = ''] = css.split('[data-theme="contrast"]');
    expect(root).toContain('--sky: #0b1d29;');
    expect(contrast).toContain('--sky: #000000;');
    expect(contrast).not.toContain('--space-4:');
  });

  it('turns aliases into var() references', () => {
    expect(css).toContain('--focus-ring: var(--ink);');
  });
});

describe('the vendored tokens.json', () => {
  it('matches the design snapshot in docs/design', () => {
    expect(kitTokens).toEqual(JSON.parse(read('../../../docs/design/tokens.json')));
  });
});
