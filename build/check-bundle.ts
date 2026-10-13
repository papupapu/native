import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { dist } from './shared.ts';

/**
 * Guards the lazy-loading contract of the spike, from the client stats (`dist/stats.json`):
 *  1. initial chunks (main, vendor, route-*) hold no LoginModal / FooterContent module;
 *  2. their emitted files do not contain the marker strings either;
 *  3. the lazy chunks exist (modal-login, footer) and DO contain the code.
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

const LAZY = [
  { chunk: 'modal-login', module: 'LoginModal', marker: '__MODAL_LOGIN__' },
  { chunk: 'footer', module: 'FooterContent', marker: '__FOOTER_CONTENT__' },
];

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

// Only the files of chunks that load at page start (main, vendor, route-*) are "eager".
const eager = chunks.filter((chunk) => chunk.initial || chunk.names?.some((name) => name.startsWith('route-')));

for (const lazy of LAZY) {
  for (const chunk of eager) {
    const label = chunk.names?.join('+') ?? '?';
    const hasModule = flatten(chunk.modules).some((name) => name.includes(lazy.module));
    check(!hasModule, `${label} does not contain module ${lazy.module}`);
    const hasMarker = jsFiles(chunk).some((file) => read(file).includes(lazy.marker));
    check(!hasMarker, `${label} does not contain marker ${lazy.marker}`);
  }

  const own = named(lazy.chunk);
  check(Boolean(own), `chunk ${lazy.chunk} exists`);
  if (own) {
    check(!own.initial, `chunk ${lazy.chunk} is not initial`);
    check(
      jsFiles(own).some((file) => read(file).includes(lazy.marker)),
      `chunk ${lazy.chunk} contains marker ${lazy.marker}`,
    );
  }
}

ok.forEach((message) => console.log(`  ok    ${message}`));
failures.forEach((message) => console.error(`  FAIL  ${message}`));
console.log(`\ncheck-bundle: ${ok.length} ok, ${failures.length} failed`);
process.exit(failures.length ? 1 : 0);
