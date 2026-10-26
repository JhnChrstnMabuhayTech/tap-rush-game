// Zips dist/ for Instant Games Web Hosting: `pnpm bundle` builds, then runs this.
// Facebook wants index.html and fbapp-config.json at the root of the zip.
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const out = fileURLToPath(new URL('../release/', import.meta.url));
const REQUIRED = ['index.html', 'fbapp-config.json'];
const RECOMMENDED_MAX_BYTES = 5 * 1024 * 1024; // Meta's recommended initial load

const files: Record<string, Uint8Array> = {};
for (const path of walk(dist)) {
  // Zip entries always use forward slashes, whatever the OS.
  files[relative(dist, path).split(sep).join('/')] = readFileSync(path);
}

const missing = REQUIRED.filter((name) => !(name in files));
if (missing.length) {
  console.error(`dist/ is missing ${missing.join(' and ')}. Run \`pnpm build\` first.`);
  process.exit(1);
}

const zip = zipSync(files, { level: 9 });
const name = `glowcatch-${version()}.zip`;
mkdirSync(out, { recursive: true });
writeFileSync(join(out, name), zip);

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
console.log(`release/${name}: ${Object.keys(files).length} files, ${kb(zip.length)}`);
if (zip.length > RECOMMENDED_MAX_BYTES) {
  console.warn(`Over the 5 MB Meta recommends for an initial load.`);
}

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else yield path;
  }
}

// The commit the build came from, so an upload in the dashboard can be traced back.
function version(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim() !== '';
    return dirty ? `${sha}-dirty` : sha;
  } catch {
    return new Date().toISOString().replace(/[:.]/g, '-');
  }
}
