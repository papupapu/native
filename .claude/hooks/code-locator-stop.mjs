#!/usr/bin/env node
// SubagentStop hook (matcher "code-locator"): checks the file:line table the locator is about to return.
// Every row `| path:N | symbol | role |` must point at a file that exists, a line within the file, and — when the
// symbol cell is a single identifier — that identifier within ±3 lines of N. Bad rows → exit 2 with the list, so the
// agent corrects or drops them (once: stop_hook_active lets the second stop through). Costs no tokens when the table
// is right. Paths are relative to the repo root (`src/…`, `build/…`).
// Never blocks on anything it cannot parse or read: fail-open. CODE_LOCATOR_STOP_LOG=<file> appends what the hook received (debugging).
import fs from 'node:fs';
import path from 'node:path';

const KEYWORDS = new Set(['export', 'default', 'async', 'function', 'const', 'let', 'var', 'class', 'type', 'interface', 'return']);
const SLACK = 3;
const MAX_BYTES = 2 * 1024 * 1024;

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    if (process.env.CODE_LOCATOR_STOP_LOG) fs.appendFileSync(process.env.CODE_LOCATOR_STOP_LOG, `${JSON.stringify({ keys: Object.keys(input), agent_type: input.agent_type, stop_hook_active: input.stop_hook_active, msgChars: String(input.last_assistant_message || '').length })}\n`);
    if (input.stop_hook_active) process.exit(0);
    if (input.agent_type && input.agent_type !== 'code-locator') process.exit(0);
    const text = String(input.last_assistant_message || '');
    const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();

    const cache = new Map();
    const linesOf = (file) => {
      if (!cache.has(file)) {
        let v = null;
        try { const st = fs.statSync(file); if (st.isFile() && st.size <= MAX_BYTES) v = fs.readFileSync(file, 'utf8').split('\n'); } catch {}
        cache.set(file, v);
      }
      return cache.get(file);
    };
    const resolve = (p) => {
      const clean = p.replace(/^\.\//, '');
      if (path.isAbsolute(clean) || clean.split('/').includes('..')) return null;
      return path.join(root, clean);
    };

    const bad = [];
    for (const line of text.split('\n')) {
      if (!line.trim().startsWith('|')) continue;
      const cells = line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      if (cells.length < 2) continue;
      const m = cells[0].replace(/`/g, '').match(/^([^\s:|]+\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?$/);
      if (!m) continue; // header, separator, or a cell we do not understand
      const [, p, a, b] = m;
      const from = Number(a), to = b ? Number(b) : from;
      const abs = resolve(p);
      const lines = abs && linesOf(abs);
      if (!lines) { bad.push(`${cells[0]}: file not found`); continue; }
      if (from < 1 || to < from) { bad.push(`${cells[0]}: invalid line range`); continue; }
      if (to > lines.length) { bad.push(`${cells[0]}: line beyond end of file (${lines.length} lines)`); continue; }

      const sym = (cells[1] || '').replace(/`/g, '').replace(/\(\)$/, '').trim();
      const ids = (sym.match(/^[A-Za-z_$][\w$.]*$/) ? sym.split('.') : sym.match(/^export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|type|interface)\s+([A-Za-z_$][\w$]*)$/)?.slice(1)) || [];
      const wanted = ids.filter((i) => i && !KEYWORDS.has(i));
      if (!wanted.length) continue;
      const hit = lines.slice(Math.max(0, from - 1 - SLACK), to + SLACK).some((l) => wanted.some((w) => l.includes(w)));
      if (!hit) bad.push(`${cells[0]}: \`${sym}\` not within ${SLACK} lines of that line`);
    }

    if (!bad.length) process.exit(0);
    process.stderr.write(`Your table has rows that do not match the code:\n${bad.map((b) => `- ${b}`).join('\n')}\nCorrect each one from what you actually saw, or drop the row and mention it in \`Not found\`. Then output the full table again in the same format. Do not start a new search round.\n`);
    process.exit(2);
  } catch {
    process.exit(0);
  }
});
