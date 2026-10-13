---
name: bundle-guard
description: Use when a branch of this portal may have made the client bundle heavier or hurt Core Web Vitals — "did the bundle grow?", "performance check of this feature", "before opening the PR". Measures first-load JS per route against the merge-base with master, judges it with budgets, then reviews the added code for bundle, LCP, CLS and INP improvements that do not degrade the UX.
---

Measure first, then read code. Never propose a change without saying what it does to the user experience.

## How

TARGET = the branch given as argument, else `master`.

1. **Scope.** `git fetch origin`, then `git diff --stat origin/<TARGET>...HEAD`. If nothing under `src/`, `build/`, `package.json` or `package-lock.json` changed, answer "no bundle impact" and stop.
2. **Build.** `npm run build` (seconds). The comparison refuses a `dist/` older than the sources.
3. **Leak check.** `npm run check:bundle`: every lazy part (modal, footer, any `import()` with a non-`route-` `webpackChunkName`) must stay out of main/vendor/route-*. A FAIL here is a BLOCKER: find the static import that pulled it in (`git diff` of the files that import it).
4. **Compare.** `npm run bundle:compare -- --modules`. The first run on a given merge-base also builds the baseline in a git worktree (`.bundle-baseline/`, removed afterwards; cached in `node_modules/.cache/bundle-guard/<sha>.json`). Thresholds: `build/bundle-budget.json`. Flags: `--json`, `--base=<ref>`, `--rebuild-base`, `--allow-stale`.
   - Exit 1 = BLOCKER, exit 2 = could not measure (the message says why: stale build, missing ref, baseline build failed).
   - Do not read `dist/` by hand (denied); the script output is the measurement. `ANALYZE=1 npm run build` writes `dist/bundle-report.html` for the person, not for you.
5. **Read the added code**, one file at a time with `git diff origin/<TARGET>...HEAD -- <file>`, starting from the modules the report says grew. Apply `references/checklist.md`. If the diff changes only styles, say so and skip the code review.
6. **Report** one line per finding: `path:line SEVERITY problem → fix · saves ~X kB / metric · UX impact`. BLOCKER → WARNING → NOTE. A fix without a stated UX impact is not a finding. Drop fixes that make the UX worse; keep them as a NOTE only when the trade-off is worth the user's decision.
7. **End** with the verdict (OK / WARNING / BLOCKER), the delta table for the routes that changed, and the top 3 actions. Do not edit code unless asked.

When a feature adds a **new route**, `bundle:compare` reports it as new and judges it against `absolute.default`; add its own entry to `build/bundle-budget.json` only with the person's agreement.

## Runtime Core Web Vitals — only when asked (`--cwv`)

Bundle size is a proxy; use this to confirm a suspected LCP/CLS/INP problem. Follow the `chrome-devtools` skill for the browser side.
- Needs the production server: `npm run build`, then `PORT=3100 npm start` in the background (log in the scratchpad), stop it at the end.
- On the routes the feature touches: `lighthouse_audit` (mobile), then `performance_start_trace` / `performance_stop_trace` and `performance_analyze_insight` for LCP, CLS, long tasks. Routes: `/`, `/annunci/:id`, `/cerca?q=`.
- No baseline server → compare with Google's "good" thresholds (LCP < 2.5 s, CLS < 0.1, INP < 200 ms; use TBT as the lab proxy for INP). Lab numbers on a laptop are indicative: report them as such. The server has artificial latency (`createInProcessServices`), so LCP includes it.

## Severity

BLOCKER = over the absolute budget, grew past the delta limit, a leak found by `check:bundle`, or a change that breaks LCP/CLS on the main path (above-the-fold content only rendered client-side, image without dimensions in the hero). WARNING = over the warn threshold or a clear checklist violation. NOTE = optional improvement.
