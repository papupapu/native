#!/usr/bin/env node
// SubagentStop hook (matcher "docs-updater"): before the docs-updater subagent returns, runs scripts/check-ai-docs.mjs
// --json on the working tree and on HEAD, and compares. Problems that exist in the tree but not in HEAD were introduced
// by the uncommitted changes → exit 2 with the list, so the agent fixes or reverts those lines (once: stop_hook_active
// lets the second stop through). Pre-existing problems, warnings, a checker crash or a clean tree never block.
// No CODEMAP.md in HEAD (first introduction) = empty baseline: every problem counts.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const checker = (root, args) => {
  const r = spawnSync('node', ['scripts/check-ai-docs.mjs', '--json', ...args], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && r.status !== 1) throw new Error(`check-ai-docs exited ${r.status}: ${(r.stderr || '').trim().split('\n').pop()}`);
  return JSON.parse(r.stdout).problems;
};
// Identity without line numbers, so a row that only moved is not "new".
const identity = (p) => `${p.kind}|${p.msg}`;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw || '{}');
    if (input.stop_hook_active) process.exit(0);
    if (input.agent_type && input.agent_type !== 'docs-updater') process.exit(0);
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    if (!fs.existsSync(path.join(root, 'scripts/check-ai-docs.mjs'))) process.exit(0);
    const status = execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
    if (!status.trim()) process.exit(0);

    let introduced;
    try {
      const now = checker(root, []);
      let before = [];
      try { before = checker(root, ['--ref', 'HEAD']); } catch {} // no HEAD yet: empty baseline
      const known = new Set(before.map(identity));
      introduced = now.filter((p) => !known.has(identity(p)));
    } catch (e) {
      process.stdout.write(`${JSON.stringify({ systemMessage: `docs-updater-stop: ${e.message}` })}\n`);
      process.exit(0);
    }
    if (!introduced.length) process.exit(0);
    process.stderr.write(`The docs you edited introduced AI-doc problems (check-ai-docs). Fix or revert these lines, verifying against the code:\n${introduced.map((p) => `- ${p.where}: [${p.kind}] ${p.msg}`).join('\n')}\n`);
    process.exit(2);
  } catch {
    process.exit(0);
  }
});
