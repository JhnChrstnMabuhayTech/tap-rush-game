// Turns the design system's tokens.json into the tokens.css the UI kit reads.
// Every token becomes a custom property named after it (`--sky`, `--dur-tap`);
// type families become `--font-<family>`. The first colour theme (Night) is
// the :root default, and each other theme overrides only the values that differ.

export interface Token {
  name: string;
  value: string | Record<string, string>;
}

export interface TokensFile {
  name: string;
  color: { themes: { id: string }[]; tokens: Token[] };
  type: { families: Record<string, string> };
  [family: string]: unknown;
}

export const HEADER =
  '/* Glowcatch tokens, generated from tokens.json by scripts/build-tokens.ts. Do not edit. */';

export function tokensToCss(file: TokensFile): string {
  const [base, ...others] = file.color.themes.map((theme) => theme.id);
  if (!base) throw new Error('tokens.json has no colour themes');

  const tokens = Object.entries(file)
    .filter(([family]) => family !== 'type')
    .flatMap(([, family]) => (hasTokens(family) ? family.tokens : []));

  const root = [
    ...Object.entries(file.type.families).map(([name, stack]) => decl(`font-${name}`, stack)),
    ...tokens.map((token) => decl(token.name, valueIn(token, base, base))),
  ];

  const themes = others.map((theme) => {
    const overrides = tokens
      .filter((token) => valueIn(token, theme, base) !== valueIn(token, base, base))
      .map((token) => decl(token.name, valueIn(token, theme, base)));
    return block(`[data-theme="${theme}"]`, overrides);
  });

  return [HEADER, block(':root', root), ...themes].join('\n\n') + '\n';
}

function hasTokens(family: unknown): family is { tokens: Token[] } {
  return (
    typeof family === 'object' &&
    family !== null &&
    Array.isArray((family as { tokens?: unknown }).tokens)
  );
}

// A theme without its own value inherits the first theme's, as in the design system.
function valueIn(token: Token, theme: string, base: string): string {
  const raw =
    typeof token.value === 'string' ? token.value : (token.value[theme] ?? token.value[base]);
  if (raw === undefined) throw new Error(`Token ${token.name} has no value for ${theme}`);
  // `{ink}` is an alias of another token.
  return raw.replace(/^\{([\w.-]+)\}$/, 'var(--$1)');
}

function decl(name: string, value: string): string {
  return `  --${name}: ${value};`;
}

function block(selector: string, lines: string[]): string {
  return `${selector} {\n${lines.join('\n')}\n}`;
}
