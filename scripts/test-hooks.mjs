#!/usr/bin/env node
// Runs the .claude/hooks scripts with fake stdin and checks the exit codes. Usage: node scripts/test-hooks.mjs
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOOKS = path.join(ROOT, '.claude/hooks');
let failed = 0, total = 0;

function run(hook, input, env = {}) {
  const r = spawnSync('node', [path.join(HOOKS, hook)], { input: JSON.stringify(input), encoding: 'utf8', env: { ...process.env, ...env } });
  return { code: r.status, out: r.stdout, err: r.stderr };
}
function expect(name, got, want) {
  total++;
  if (got === want) { console.log(`ok   ${name}`); return; }
  failed++; console.log(`FAIL ${name}: exit ${got}, expected ${want}`);
}

// --- code-locator-budget ---
{
  const id = `test-${process.pid}-${Date.now()}`;
  const call = (extra = {}) => run('code-locator-budget.mjs', { agent_type: 'code-locator', agent_id: id, tool_name: 'Grep', tool_input: {}, ...extra }, { CODE_LOCATOR_BUDGET: '6' });
  expect('budget: other agent passes', run('code-locator-budget.mjs', { agent_type: 'general-purpose', agent_id: id, tool_name: 'Grep' }).code, 0);
  const codes = Array.from({ length: 7 }, () => call().code);
  expect('budget: calls 1-6 pass', codes.slice(0, 6).every((c) => c === 0) ? 0 : 1, 0);
  expect('budget: 7th call blocked', codes[6], 2);
  expect('budget: hint on call 5', call({ agent_id: `${id}-b` }).out, '');
  const idc = `${id}-c`;
  for (let i = 0; i < 4; i++) run('code-locator-budget.mjs', { agent_type: 'code-locator', agent_id: idc, tool_name: 'Read' });
  expect('budget: hint text at call 5', /Tool call 5 of 6/.test(run('code-locator-budget.mjs', { agent_type: 'code-locator', agent_id: idc, tool_name: 'Read' }).out) ? 0 : 1, 0);
  const bash = (command, n) => run('code-locator-budget.mjs', { agent_type: 'code-locator', agent_id: `${id}-bash${n}`, tool_name: 'Bash', tool_input: { command } });
  expect('budget: Bash on dist/ blocked', bash('grep -n render dist/server/render.cjs', 1).code, 2);
  expect('budget: Bash on node_modules blocked', bash('ls node_modules/react', 2).code, 2);
  expect('budget: grep -r without target blocked', bash('grep -rn render .', 3).code, 2);
  expect('budget: grep -r on src passes', bash('grep -rn render src', 4).code, 0);
  expect('budget: git grep passes', bash('git grep --untracked -n render -- src build', 5).code, 0);
  expect('budget: bad stdin fails open', run('code-locator-budget.mjs', 'not json').code, 0);
}

// --- code-locator-stop ---
{
  const f = 'src/app/routes.ts';
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const idx = lines.findIndex((l) => l.includes('routes'));
  const stop = (table, extra = {}) => run('code-locator-stop.mjs', { agent_type: 'code-locator', last_assistant_message: table, ...extra }, { CLAUDE_PROJECT_DIR: ROOT });
  const row = (loc, sym) => `| file:line | symbol | role |\n| --- | --- | --- |\n| ${loc} | ${sym} | x |\n`;
  expect('stop: correct row passes', stop(row(`${f}:${idx + 1}`, '`routes`')).code, 0);
  expect('stop: line past end blocked', stop(row(`${f}:${lines.length + 50}`, '`routes`')).code, 2);
  expect('stop: distant symbol blocked', stop(row(`${f}:${idx + 1}`, '`zzzNotThere`')).code, 2);
  expect('stop: missing file blocked', stop(row('src/nope/missing.ts:1', '`x`')).code, 2);
  expect('stop: path with .. blocked', stop(row('../etc/passwd.txt:1', '`x`')).code, 2);
  expect('stop: stop_hook_active passes', stop(row('src/nope/missing.ts:1', '`x`'), { stop_hook_active: true }).code, 0);
  expect('stop: other agent passes', stop(row('src/nope/missing.ts:1', '`x`'), { agent_type: 'docs-updater' }).code, 0);
  expect('stop: no table passes', stop('Not found: everything').code, 0);
}

// --- docs-updater-stop (temporary git repo with a copy of the checker) ---
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-updater-stop-'));
  const git = (...a) => execFileSync('git', a, { cwd: tmp, stdio: 'ignore' });
  const w = (f, s) => { fs.mkdirSync(path.dirname(path.join(tmp, f)), { recursive: true }); fs.writeFileSync(path.join(tmp, f), s); };
  w('scripts/check-ai-docs.mjs', fs.readFileSync(path.join(ROOT, 'scripts/check-ai-docs.mjs'), 'utf8'));
  w('src/a.ts', 'export const alpha = 1;\n');
  w('CODEMAP.md', '| Path | Role |\n| --- | --- |\n| `src/a.ts` | `alpha` |\n');
  git('init', '-q'); git('config', 'user.email', 't@t'); git('config', 'user.name', 't'); git('add', '-A'); git('commit', '-qm', 'init');
  const stop = (extra = {}) => run('docs-updater-stop.mjs', { agent_type: 'docs-updater', ...extra }, { CLAUDE_PROJECT_DIR: tmp });

  expect('docs-stop: clean tree passes', stop().code, 0);
  w('CODEMAP.md', '| Path | Role |\n| --- | --- |\n| `src/a.ts` | `alpha` |\n| `src/gone.ts` | `beta` |\n');
  expect('docs-stop: broken row after commit blocked', stop().code, 2);
  expect('docs-stop: stop_hook_active passes', stop({ stop_hook_active: true }).code, 0);
  git('add', '-A'); git('commit', '-qm', 'commit the broken row');
  w('README.md', 'touched\n');
  expect('docs-stop: problem already in HEAD passes', stop().code, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`\n${total - failed}/${total} passed`);
process.exitCode = failed ? 1 : 0;
