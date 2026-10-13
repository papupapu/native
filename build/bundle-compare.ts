import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import type { AssetManifest } from '../src/shared/manifest.ts';
import { dist, root } from './shared.ts';

/**
 * Client bundle weight of the current build (`dist/`) vs the merge-base with master, judged against
 * `build/bundle-budget.json`. Sizes are kB gzip, summed per emitted file.
 *
 * The base side is built once per merge-base commit in a git worktree (`.bundle-baseline/`, removed
 * afterwards) and cached in `node_modules/.cache/bundle-guard/<sha>.json`.
 * Route growth is judged on the route's own chunk (shared growth is reported once, under "shared"),
 * the absolute budget on first-load JS (entry + route chunk). Lazy chunks (modal-*, footer) are
 * reported but not judged: they are not first load.
 *
 * Usage: node build/bundle-compare.ts [--base=origin/master] [--modules] [--json] [--rebuild-base] [--allow-stale]
 * Exit: 0 ok or warnings, 1 BLOCKER, 2 could not measure.
 */

interface StatsModule {
  name?: string;
  size?: number;
  modules?: StatsModule[];
}
interface StatsChunk {
  names?: string[];
  initial?: boolean;
  modules?: StatsModule[];
}
interface Size {
  js: number;
  css: number;
}
interface Metrics {
  sha: string;
  shared: Size;
  routes: Record<string, Size & { firstLoadJs: number }>;
  lazy: Record<string, Size>;
  /** Source size (not gzip, ranking only) of the modules in eager chunks, by package or file. */
  modules: Record<string, number>;
}
interface Budget {
  delta: { routeWarnKb: number; routeBlockKb: number; sharedWarnKb: number; sharedBlockKb: number };
  absolute: Record<string, number>;
}
type Severity = 'BLOCKER' | 'WARNING' | 'NOTE';
interface Finding {
  severity: Severity;
  message: string;
}

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key = '', value] = arg.replace(/^--/, '').split('=');
    return [key, value ?? true];
  }),
);
const baselineDir = path.join(root, '.bundle-baseline');
const cacheDir = path.join(root, 'node_modules', '.cache', 'bundle-guard');
const log = (...message: unknown[]) => console.error(...message); // stdout is for the report / --json

function fail(message: string): never {
  log(`bundle-compare: ${message}`);
  process.exit(2);
}

function git(...gitArgs: string[]): string {
  return execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

const kb = (bytes: number) => Math.round((bytes / 1024) * 100) / 100;
const fmt = (value: number) => value.toFixed(2);
const signed = (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;

// --- measuring ------------------------------------------------------------------------------

function gzipOf(distDir: string, files: string[]): number {
  return files.reduce((sum, file) => {
    const full = path.join(distDir, 'client', file.replace(/^\/static\//, ''));
    return sum + gzipSync(readFileSync(full), { level: 9 }).length;
  }, 0);
}

function sizeOf(distDir: string, group: { js: string[]; css: string[] }): Size {
  return { js: kb(gzipOf(distDir, group.js)), css: kb(gzipOf(distDir, group.css)) };
}

function leafModules(modules: StatsModule[] = []): StatsModule[] {
  return modules.flatMap((mod) => (mod.modules?.length ? leafModules(mod.modules) : [mod]));
}

function moduleKey(raw: string): string {
  const name = (raw.split('!').pop() ?? raw).replace(/^css /, '');
  const pkg = name.match(/node_modules\/((?:@[^/]+\/)?[^/]+)\/[^]*$/);
  if (pkg?.[1]) return pkg[1];
  return name.replace(/^\.\//, '').replace(/ \+ \d+ modules?$/, '');
}

function measure(distDir: string, sha: string): Metrics {
  const manifestFile = path.join(distDir, 'client', 'manifest.json');
  const statsFile = path.join(distDir, 'stats.json');
  if (!existsSync(manifestFile) || !existsSync(statsFile)) fail(`${distDir}: manifest.json / stats.json missing, run a build`);
  const manifest = JSON.parse(readFileSync(manifestFile, 'utf8')) as AssetManifest;
  const { chunks = [] } = JSON.parse(readFileSync(statsFile, 'utf8')) as { chunks?: StatsChunk[] };

  const shared = sizeOf(distDir, manifest.entry);
  const routes: Metrics['routes'] = {};
  const lazy: Metrics['lazy'] = {};
  for (const [name, group] of Object.entries(manifest.groups)) {
    const size = sizeOf(distDir, group);
    if (name.startsWith('route-')) routes[name] = { ...size, firstLoadJs: kb((shared.js + size.js) * 1024) };
    else lazy[name] = size;
  }

  const modules: Record<string, number> = {};
  const eager = chunks.filter((chunk) => chunk.initial || chunk.names?.some((name) => name.startsWith('route-')));
  for (const chunk of eager) {
    for (const mod of leafModules(chunk.modules)) {
      if (!mod.name) continue; // runtime modules carry no name
      const key = moduleKey(mod.name);
      modules[key] = kb((modules[key] ?? 0) * 1024 + (mod.size ?? 0));
    }
  }
  return { sha, shared, routes, lazy, modules };
}

// --- baseline -------------------------------------------------------------------------------

function newestSource(): number {
  let newest = statSync(path.join(root, 'package.json')).mtimeMs;
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  for (const dir of ['src', 'build']) walk(path.join(root, dir));
  return newest;
}

function resolveBase(): string {
  const requested = typeof args['base'] === 'string' ? args['base'] : undefined;
  const candidates = requested ? [requested] : ['origin/master', 'master'];
  for (const ref of candidates) {
    try {
      return git('merge-base', 'HEAD', ref);
    } catch {
      /* try the next candidate */
    }
  }
  return fail(`no base ref found (tried ${candidates.join(', ')}): fetch origin or pass --base=<ref>`);
}

function buildBaseline(sha: string): Metrics {
  const cacheFile = path.join(cacheDir, `${sha}.json`);
  if (!args['rebuild-base'] && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8')) as Metrics;

  log(`bundle-compare: building baseline ${sha.slice(0, 8)} in a worktree (cached afterwards)`);
  rmSync(baselineDir, { recursive: true, force: true });
  git('worktree', 'prune');
  git('worktree', 'add', '--detach', baselineDir, sha);
  try {
    // Same dependencies as head: reuse node_modules. When the lockfile differs the numbers would
    // mix versions, so install the baseline's own.
    const lockChanged = git('diff', '--name-only', sha, 'HEAD', '--', 'package-lock.json') !== '';
    if (lockChanged) {
      log('bundle-compare: package-lock.json changed since the base, running npm ci in the worktree');
      const install = spawnSync('npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: baselineDir, stdio: ['ignore', 'ignore', 'inherit'] });
      if (install.status !== 0) fail('npm ci failed in the baseline worktree');
    } else {
      symlinkSync(path.join(root, 'node_modules'), path.join(baselineDir, 'node_modules'), 'dir');
    }
    // Older commits wrote stats.json without module names; head's build.ts is the reference for the report.
    const baseBuild = path.join(baselineDir, 'build', 'build.ts');
    if (!readFileSync(baseBuild, 'utf8').includes('modulesSpace')) copyFileSync(path.join(root, 'build', 'build.ts'), baseBuild);
    const build = spawnSync(process.execPath, ['build/build.ts'], { cwd: baselineDir, stdio: ['ignore', 'ignore', 'inherit'] });
    if (build.status !== 0) fail('the baseline build failed');
    const metrics = measure(path.join(baselineDir, 'dist'), sha);
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(metrics));
    return metrics;
  } finally {
    try {
      git('worktree', 'remove', '--force', baselineDir);
    } catch {
      rmSync(baselineDir, { recursive: true, force: true });
      git('worktree', 'prune');
    }
  }
}

// --- judging --------------------------------------------------------------------------------

function judge(head: Metrics, base: Metrics | null, budget: Budget): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Severity, message: string) => findings.push({ severity, message });
  const { delta, absolute } = budget;

  if (base) {
    const sharedGrowth = head.shared.js - base.shared.js;
    if (sharedGrowth >= delta.sharedBlockKb) add('BLOCKER', `shared (vendor + main) grew ${signed(sharedGrowth)} kB (block at ${delta.sharedBlockKb})`);
    else if (sharedGrowth >= delta.sharedWarnKb) add('WARNING', `shared (vendor + main) grew ${signed(sharedGrowth)} kB (warn at ${delta.sharedWarnKb})`);
  }
  for (const [name, route] of Object.entries(head.routes)) {
    const before = base?.routes[name];
    if (before) {
      const growth = route.js - before.js;
      if (growth >= delta.routeBlockKb) add('BLOCKER', `${name} own chunk grew ${signed(growth)} kB (block at ${delta.routeBlockKb})`);
      else if (growth >= delta.routeWarnKb) add('WARNING', `${name} own chunk grew ${signed(growth)} kB (warn at ${delta.routeWarnKb})`);
    } else if (base) {
      add('NOTE', `${name} is a new route (${fmt(route.js)} kB own chunk)`);
    }
    const limit = absolute[name] ?? absolute['default'];
    if (limit === undefined) add('NOTE', `${name} has no absolute budget and there is no "default"`);
    else if (route.firstLoadJs > limit) add('BLOCKER', `${name} first-load JS ${fmt(route.firstLoadJs)} kB is over its budget of ${limit} kB`);
    else if (route.firstLoadJs > limit * 0.95) add('WARNING', `${name} first-load JS ${fmt(route.firstLoadJs)} kB is within 5% of its budget of ${limit} kB`);
  }
  return findings;
}

function report(head: Metrics, base: Metrics | null, findings: Finding[], budget: Budget, withModules: boolean): string {
  const lines: string[] = [];
  const row = (label: string, now: number, before: number | undefined, extra = '') =>
    `| ${label} | ${fmt(now)} | ${before === undefined ? 'new' : fmt(before)} | ${before === undefined ? '' : signed(now - before)} | ${extra} |`;

  lines.push(`base ${base ? base.sha.slice(0, 8) : '(none: head is the merge-base)'} → head ${head.sha.slice(0, 8)}, kB gzip`, '');
  lines.push('| JS | head | base | delta | budget |', '| --- | ---: | ---: | ---: | ---: |');
  lines.push(row('shared (vendor + main)', head.shared.js, base?.shared.js));
  for (const [name, route] of Object.entries(head.routes)) {
    lines.push(row(`${name} own`, route.js, base?.routes[name]?.js));
    const limit = budget.absolute[name] ?? budget.absolute['default'];
    lines.push(row(`${name} first load`, route.firstLoadJs, base?.routes[name]?.firstLoadJs, limit === undefined ? '' : String(limit)));
  }
  for (const [name, size] of Object.entries(head.lazy)) lines.push(row(`${name} (lazy, not judged)`, size.js, base?.lazy[name]?.js));
  lines.push('', `CSS: shared ${fmt(head.shared.css)} kB; ` + Object.entries(head.routes).map(([name, route]) => `${name} ${fmt(route.css)}`).join(', '));

  if (withModules && base) {
    const moves = Object.entries(head.modules)
      .map(([key, size]) => ({ key, size, change: size - (base.modules[key] ?? 0), isNew: !(key in base.modules) }))
      .filter((m) => Math.abs(m.change) >= 1)
      .sort((a, b) => b.change - a.change)
      .slice(0, 10);
    lines.push('', 'Modules in eager chunks, source kB (ranking, not gzip):');
    lines.push(...(moves.length ? moves.map((m) => `  ${signed(m.change)}  ${m.key}${m.isNew ? '  (new)' : ''}`) : ['  no module moved by 1 kB or more']));
  }

  lines.push('');
  const order: Severity[] = ['BLOCKER', 'WARNING', 'NOTE'];
  const sorted = [...findings].sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity));
  lines.push(...(sorted.length ? sorted.map((f) => `${f.severity}  ${f.message}`) : ['no findings']));
  const verdict = findings.some((f) => f.severity === 'BLOCKER') ? 'BLOCKER' : findings.some((f) => f.severity === 'WARNING') ? 'WARNING' : 'OK';
  lines.push('', `verdict: ${verdict}`);
  return lines.join('\n');
}

// --- main -----------------------------------------------------------------------------------

const budget = JSON.parse(readFileSync(path.join(import.meta.dirname, 'bundle-budget.json'), 'utf8')) as Budget;
const statsFile = path.join(dist, 'stats.json');
if (!existsSync(statsFile)) fail('dist/stats.json not found: run `npm run build` first');
if (!args['allow-stale'] && statSync(statsFile).mtimeMs < newestSource()) {
  fail('dist is older than src/ build/ package.json: run `npm run build` (or pass --allow-stale)');
}

const baseSha = resolveBase();
const headSha = git('rev-parse', 'HEAD');
const head = measure(dist, `${headSha}${git('status', '--porcelain') ? '+dirty' : ''}`);
const base = baseSha === headSha && !git('status', '--porcelain', '--', 'src', 'build', 'package.json') ? null : buildBaseline(baseSha);

const findings = judge(head, base, budget);
if (args['json']) console.log(JSON.stringify({ head, base, findings }, null, 2));
else console.log(report(head, base, findings, budget, Boolean(args['modules'])));
process.exit(findings.some((f) => f.severity === 'BLOCKER') ? 1 : 0);
