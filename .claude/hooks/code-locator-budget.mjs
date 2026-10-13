#!/usr/bin/env node
// PreToolUse hook (project settings, all tools): enforces the code-locator tool-call budget.
// Acts only on calls made by the code-locator subagent (stdin agent_type); everything else passes.
// Counts calls per agent run (agent_id, else transcript_path, else session_id) in $TMPDIR: one appended byte per
// call, the file size is the count (atomic under parallel calls). The counter restarts after a gap longer than
// CODE_LOCATOR_GAP_MS (default 2 min: the run was finished or resumed). A Bash command that reads build output
// (dist/, node_modules/) or runs a recursive grep without a src/ or build/ target is blocked and does not count.
// At calls BUDGET-1 and BUDGET the agent gets a "batch now" hint; later calls are blocked with a message telling
// it to output its table. CODE_LOCATOR_BUDGET overrides the default of 6. Never blocks on parse errors.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const BUDGET = Number(process.env.CODE_LOCATOR_BUDGET) || 6;
const GAP_MS = Number(process.env.CODE_LOCATOR_GAP_MS) || 2 * 60 * 1000;

// Returns a reason when the command must not run, else null.
function guardBash(cmd) {
  if (/(^|[\s'"=/])(dist|node_modules)(\/|\s|$|['"])/.test(cmd)) return 'dist/ and node_modules/ are build output and dependencies, not source: search src/ and build/ only.';
  const recursive = /\bgrep\b[^|;&]*\s-[a-zA-Z]*[rR][a-zA-Z]*\b|\bgrep\b[^|;&]*--recursive/.test(cmd);
  if (recursive && !/(^|\s)(src|build)(\/|\s|$)/.test(cmd)) return 'Recursive grep needs an explicit src/ or build/ target. Prefer the Grep tool, or `git grep --untracked -n PATTERN -- src build`.';
  return null;
}

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    if (input.agent_type !== 'code-locator') process.exit(0);
    const key = String(input.agent_id || input.transcript_path || input.session_id || '').replace(/[^\w-]/g, '_').slice(-120);
    if (!key) process.exit(0);

    if (input.tool_name === 'Bash' && typeof input.tool_input?.command === 'string') {
      const why = guardBash(input.tool_input.command);
      if (why) { process.stderr.write(`${why}\n`); process.exit(2); }
    }

    const file = path.join(os.tmpdir(), `code-locator-budget-${key}`);
    try { if (Date.now() - fs.statSync(file).mtimeMs > GAP_MS) fs.unlinkSync(file); } catch {}
    fs.appendFileSync(file, '.');
    const n = fs.statSync(file).size;

    if (n <= BUDGET) {
      if (n >= BUDGET - 1) {
        process.stdout.write(JSON.stringify({
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            additionalContext: `Tool call ${n} of ${BUDGET}. ${n === BUDGET ? 'This is your last call' : 'One call left after this'}: batch every remaining lookup now (Grep with alternatives, Read ranges), then output the table with unanswered parts in \`Not found\`.`,
          },
        }));
      }
      process.exit(0);
    }
    process.stderr.write(`Budget reached (${BUDGET} tool calls). Do not call more tools: output the table now with what you have, unanswered parts in \`Not found\`.\n`);
    process.exit(2);
  } catch {
    process.exit(0);
  }
});
