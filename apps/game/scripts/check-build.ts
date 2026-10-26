// Fails the build if the design tokens didn't survive it verbatim. The UI kit
// reads tokens at runtime (durations with parseFloat, as milliseconds), so a
// minifier rewriting "800ms" as ".8s" broke the countdown and cut the catch
// popups short. Runs after `vite build`.
import { readdirSync, readFileSync } from 'node:fs';

const kit = new URL('../src/kit/', import.meta.url);
const assets = new URL('../dist/assets/', import.meta.url);

const declarations = (css: string) =>
  new Map([...css.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)].map((m) => [m[1]!, m[2]!.trim()]));

const source = declarations(readFileSync(new URL('tokens.css', kit), 'utf8'));
const built = declarations(
  readdirSync(assets)
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(new URL(file, assets), 'utf8'))
    .join('\n'),
);

const changed = [...source].filter(
  ([name, value]) => built.get(name)?.replace(/\s+/g, ' ') !== value.replace(/\s+/g, ' '),
);
if (changed.length) {
  console.error('The build changed these design tokens; the kit reads them at runtime:');
  for (const [name, value] of changed)
    console.error(`  --${name}: ${value}  →  ${built.get(name) ?? '(missing)'}`);
  process.exit(1);
}
console.log(`Design tokens intact in the build (${source.size} checked).`);
