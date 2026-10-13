#!/usr/bin/env node
// Deterministic check of CODEMAP.md (no LLM, no dependencies). Paths are relative to the repo root.
//   codemap-path     a backticked path token does not exist (brace expansion {a,b} and `dir/` supported, `*` globs too).
//                    Exempt: dist/, node_modules/ (build output, gitignored). A bare file name (`route.ts`) matches any file.
//   codemap-symbol   a backticked identifier appears in none of the files the same line names (a directory counts recursively).
//                    Lines that name no file are not checked.
//   codemap-unused   a line marked **Unused** names a file that another file in src/ or build/ imports.
//   codemap-lineref  `file.ext:123` or `~L123`: lines drift, name the symbol instead (also checked in CLAUDE.md).
// Warning (never changes the exit code): uncovered-file, a file under src/ or build/ that no path token of CODEMAP.md covers.
// Usage: node scripts/check-ai-docs.mjs [--json] [--ref <commit>]
//   --ref reads the files from that commit (the baseline of the SubagentStop hook); no CODEMAP.md there = nothing to check.
// Exit: 0 ok, 1 problems, 2 usage error / crash. False positives: scripts/ai-docs-allowlist.json { "paths": [], "symbols": [] },
// entries "token" or "<file token>:<symbol>" (symbols).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

class UsageError extends Error {}
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN_DIRS = ['src/', 'build/'];
const TEXT_EXT = /\.(ts|tsx|mjs|cjs|js|scss|json|md|html)$/;
const EXEMPT_PREFIX = ['dist/', 'node_modules/'];

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });

function makeReader(ref) {
  let files;
  if (ref) {
    try { git(['rev-parse', '--verify', `${ref}^{commit}`]); } catch { throw new UsageError(`unknown commit ${ref}`); }
    files = git(['ls-tree', '-r', '--name-only', '-z', ref]).split('\0').filter(Boolean);
  } else {
    files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0').filter((f) => f && fs.existsSync(path.join(ROOT, f)));
  }
  const cache = new Map();
  const read = (f) => {
    if (!cache.has(f)) {
      let text = null;
      try { text = ref ? git(['show', `${ref}:${f}`]) : fs.readFileSync(path.join(ROOT, f), 'utf8'); } catch {}
      cache.set(f, text);
    }
    return cache.get(f);
  };
  return { files: [...new Set(files)], has: (f) => files.includes(f), read };
}

function expandBraces(token) {
  const m = token.match(/\{([^{}]*)\}/);
  if (!m) return [token];
  return m[1].split(',').flatMap((alt) => expandBraces(token.replace(m[0], alt)));
}

const globToRegex = (g) => new RegExp(`^${g.replace(/[.+^$()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}$`);

// A backticked token is a path when it has a slash or a known extension, and none of the characters of a URL, a command or a template.
function isPathToken(t) {
  if (/\s/.test(t)) return false;
  if (/^[/\-<$]/.test(t) || /[:?=&|()<>]/.test(t)) return false;
  return t.includes('/') || /^[\w.*{},-]+\.(ts|tsx|mjs|cjs|js|scss|json|md|html)$/.test(t);
}
const isSymbolToken = (t) => /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*(\(\))?$/.test(t);

function loadAllowlist() {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/ai-docs-allowlist.json'), 'utf8')); } catch { return {}; }
}

// Resolves one path token to the files it names. `bare` = no slash (matches by base name anywhere).
function resolveToken(token, reader) {
  const out = [];
  for (const t of expandBraces(token)) {
    const bare = !t.includes('/');
    if (t.endsWith('/')) out.push(...reader.files.filter((f) => f.startsWith(t)));
    else if (t.includes('*')) { const re = globToRegex(t); out.push(...reader.files.filter((f) => re.test(f))); }
    else if (bare) out.push(...reader.files.filter((f) => f === t || f.endsWith(`/${t}`)));
    else if (reader.has(t)) out.push(t);
    else out.push(...reader.files.filter((f) => f.startsWith(`${t}/`))); // a directory written without the trailing slash
  }
  return out;
}

function importedBy(file, reader) {
  const base = path.posix.basename(file).replace(/\.[^.]+$/, '');
  const re = new RegExp(`['"][^'"\\n$]*/${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.\\w+)?['"]`);
  return reader.files.filter((f) => f !== file && SCAN_DIRS.some((d) => f.startsWith(d)) && TEXT_EXT.test(f) && re.test(reader.read(f) ?? ''));
}

function checkCodemap(reader, allow) {
  const text = reader.read('CODEMAP.md');
  const problems = [], warnings = [], covered = new Set();
  const allowPath = new Set(allow.paths ?? []), allowSym = new Set(allow.symbols ?? []);
  let fenced = false, unusedVerified = 0;

  text.split('\n').forEach((line, i) => {
    const where = `CODEMAP.md:${i + 1}`;
    if (/^\s*```/.test(line)) { fenced = !fenced; return; }
    if (fenced) return;

    for (const m of line.matchAll(/[\w./-]+\.(?:ts|tsx|mjs|cjs|js|scss|json|md):\d+\b|~L\d+/g))
      problems.push({ where, kind: 'codemap-lineref', msg: `line reference "${m[0]}": name the symbol, lines drift` });

    const tokens = [...line.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim());
    const named = new Set();
    for (const t of tokens.filter(isPathToken)) {
      if (EXEMPT_PREFIX.some((p) => t.startsWith(p)) || allowPath.has(t)) continue;
      const found = resolveToken(t, reader);
      if (!found.length) { problems.push({ where, kind: 'codemap-path', msg: `\`${t}\` does not exist` }); continue; }
      found.forEach((f) => named.add(f));
      if (t.includes('/')) found.forEach((f) => covered.add(f));
    }

    if (named.size) {
      const bodies = [...named].map((f) => reader.read(f) ?? '');
      for (const t of tokens.filter((x) => !isPathToken(x) && isSymbolToken(x))) {
        const sym = t.replace(/\(\)$/, '');
        const last = sym.split('.').pop();
        if (allowSym.has(sym) || allowSym.has(t)) continue;
        if (!bodies.some((b) => b.includes(last))) problems.push({ where, kind: 'codemap-symbol', msg: `\`${sym}\` not found in the files of this line (${[...named].slice(0, 3).join(', ')}${named.size > 3 ? ', …' : ''})` });
      }
    }

    if (line.includes('**Unused**')) {
      for (const f of named) {
        const users = importedBy(f, reader);
        if (users.length) problems.push({ where, kind: 'codemap-unused', msg: `${f} is marked **Unused** but ${users[0]} imports it` });
        else unusedVerified++;
      }
    }
  });

  for (const f of reader.files)
    if (SCAN_DIRS.some((d) => f.startsWith(d)) && !covered.has(f)) warnings.push({ where: f, kind: 'uncovered-file', msg: 'no path token of CODEMAP.md covers this file' });
  return { problems, warnings, stats: { unusedVerified, covered: covered.size } };
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes('--json');
  let ref = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--ref') { ref = args[++i]; if (!ref || ref.startsWith('--')) throw new UsageError('--ref needs a commit'); }
    else if (args[i] !== '--json') throw new UsageError(`unknown argument ${args[i]}`);
  }
  const reader = makeReader(ref);
  const problems = [], warnings = [];
  let stats = {};

  if (!reader.has('CODEMAP.md')) {
    if (!ref) throw new UsageError('no CODEMAP.md in the repo root');
  } else {
    const r = checkCodemap(reader, loadAllowlist());
    problems.push(...r.problems); warnings.push(...r.warnings); stats = r.stats;
  }
  for (const doc of ['CLAUDE.md']) {
    const text = reader.read(doc);
    if (!text) continue;
    let fenced = false;
    text.split('\n').forEach((line, i) => {
      if (/^\s*```/.test(line)) { fenced = !fenced; return; }
      if (!fenced) for (const m of line.matchAll(/[\w./-]+\.(?:ts|tsx|mjs|cjs|js|scss|json|md):\d+\b|~L\d+/g))
        problems.push({ where: `${doc}:${i + 1}`, kind: 'codemap-lineref', msg: `line reference "${m[0]}": name the symbol, lines drift` });
    });
  }

  if (json) { console.log(JSON.stringify({ problems, warnings, stats }, null, 2)); return problems.length ? 1 : 0; }
  if (warnings.length) console.log(`Warnings (not blocking):\n${warnings.map((w) => `WARNING ${w.where}: ${w.msg}`).join('\n')}\n`);
  if (problems.length) {
    console.log(problems.map((p) => `${p.where}: [${p.kind}] ${p.msg}`).join('\n'));
    console.log(`\n${problems.length} problem(s): fix the doc, not the code, unless the code is wrong.`);
    return 1;
  }
  console.log(`AI docs OK: CODEMAP paths, symbols, line refs, ${stats.unusedVerified ?? 0} Unused markers verified.`);
  return 0;
}

try { process.exitCode = main(); }
catch (e) {
  console.error(e instanceof UsageError ? `check-ai-docs: ${e.message}` : `check-ai-docs: internal error: ${e.stack || e}`);
  process.exitCode = 2;
}
