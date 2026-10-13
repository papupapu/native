import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { dist, root } from './shared.ts';

/**
 * Guards the lazy-loading contract from the client stats (`dist/stats.json`). The contract is
 * discovered from the source, nothing to register: every `import(/* webpackChunkName: "x" *\/ './File.tsx')`
 * whose chunk name does not start with `route-` declares a lazy part (modal, ...). For each:
 *  1. initial chunks (main, vendor, route-*) hold no module of that file;
 *  2. its chunk exists, is not initial, and holds the file;
 *  3. when the file exports a `*_MARKER = '__X__'` constant, the marker string is absent from the
 *     emitted files of the initial chunks and present in the lazy chunk (guards against a stats blind spot).
 */

interface StatsModule {
  name?: string;
  modules?: StatsModule[];
}
interface StatsChunk {
  names?: string[];
  files?: string[];
  initial?: boolean;
  modules?: StatsModule[];
}
interface Lazy {
  chunk: string;
  /** Path relative to the repo root, forward slashes. */
  file: string;
  marker?: string;
}

const IMPORT = /import\(\s*\/\*\s*webpackChunkName:\s*"([^"]+)"\s*\*\/\s*'([^']+)'\s*\)/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function discoverLazy(): Lazy[] {
  const found = new Map<string, Lazy>();
  for (const importer of sourceFiles(path.join(root, 'src'))) {
    for (const [, chunk = '', specifier = ''] of readFileSync(importer, 'utf8').matchAll(IMPORT)) {
      if (chunk.startsWith('route-') || !specifier.startsWith('.')) continue;
      const target = path.relative(root, path.resolve(path.dirname(importer), specifier)).split(path.sep).join('/');
      const marker = readFileSync(path.join(root, target), 'utf8').match(/export const \w*MARKER\w* = '(__\w+__)'/)?.[1];
      found.set(`${chunk}:${target}`, { chunk, file: target, ...(marker ? { marker } : {}) });
    }
  }
  return [...found.values()];
}

const statsFile = path.join(dist, 'stats.json');
if (!existsSync(statsFile)) {
  console.error('dist/stats.json not found: run `npm run build` first');
  process.exit(1);
}
const { chunks = [] } = JSON.parse(readFileSync(statsFile, 'utf8')) as { chunks?: StatsChunk[] };

function flatten(modules: StatsModule[] = []): string[] {
  return modules.flatMap((mod) => [mod.name ?? '', ...flatten(mod.modules)]);
}

const failures: string[] = [];
const ok: string[] = [];
const check = (pass: boolean, message: string) => (pass ? ok : failures).push(message);

const lazyParts = discoverLazy();
check(lazyParts.length > 0, `found ${lazyParts.length} lazy part(s) in src/ (import() with a non-route webpackChunkName)`);

// Lazy chunks are resolved through the manifest groups (what the server actually links), not through chunk names.
const manifest = JSON.parse(readFileSync(path.join(dist, 'client', 'manifest.json'), 'utf8')) as {
  groups: Record<string, { js: string[] }>;
};
const named = (name: string) => {
  const files = (manifest.groups[name]?.js ?? []).map((file) => file.replace(/^\/static\//, ''));
  return chunks.find((chunk) => files.length > 0 && files.every((file) => chunk.files?.includes(file)));
};
const jsFiles = (chunk: StatsChunk) => (chunk.files ?? []).filter((file) => file.endsWith('.js'));
const read = (file: string) => readFileSync(path.join(dist, 'client', file), 'utf8');
const holds = (chunk: StatsChunk, file: string) => flatten(chunk.modules).some((name) => name.replace(/^\.\//, '').startsWith(file));

// Only the files of chunks that load at page start (main, vendor, route-*) are "eager".
const eager = chunks.filter((chunk) => chunk.initial || chunk.names?.some((name) => name.startsWith('route-')));

for (const lazy of lazyParts) {
  for (const chunk of eager) {
    const label = chunk.names?.join('+') ?? '?';
    check(!holds(chunk, lazy.file), `${label} does not contain ${lazy.file}`);
    if (lazy.marker) {
      const marker = lazy.marker;
      check(!jsFiles(chunk).some((file) => read(file).includes(marker)), `${label} does not contain marker ${marker}`);
    }
  }

  const own = named(lazy.chunk);
  check(Boolean(own), `chunk ${lazy.chunk} exists`);
  if (own) {
    check(!own.initial, `chunk ${lazy.chunk} is not initial`);
    check(holds(own, lazy.file), `chunk ${lazy.chunk} contains ${lazy.file}`);
    if (lazy.marker) {
      const marker = lazy.marker;
      check(jsFiles(own).some((file) => read(file).includes(marker)), `chunk ${lazy.chunk} contains marker ${marker}`);
    }
  }
}

ok.forEach((message) => console.log(`  ok    ${message}`));
failures.forEach((message) => console.error(`  FAIL  ${message}`));
console.log(`\ncheck-bundle: ${ok.length} ok, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
