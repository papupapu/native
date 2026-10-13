---
name: chrome-devtools
description: Use to debug or verify the running portal in a real browser — rendered page vs server HTML, hydration errors, console, network, performance, Lighthouse — via the chrome-devtools MCP server.
---

Tools: `mcp__chrome-devtools__*` (server in the project `.mcp.json`, attached to Chrome on port 9222). If deferred, load them with ToolSearch `+chrome-devtools`.

## Setup

```bash
nc -z 127.0.0.1 9222 && echo READY || echo "NOT READY"

# Separate debug instance — never kill the user's Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug --no-first-run &
```

| Mode | Command | URL |
| --- | --- | --- |
| Dev (HMR, unminified) | `npm run dev` | http://localhost:3000 (`PORT` to change) |
| Production (what Lighthouse and bundle-guard must measure) | `npm run build`, then `PORT=3100 npm start` | http://localhost:3100 |

Run the server in the background with its log in the scratchpad, and stop it when done. Routes: `/`, `/annunci/:id`, `/cerca?q=`, `/swpeople/:id` (calls swapi.dev), anything else is the 404 page. `/api/v1/*` is what client navigations call.

## Loop (cheapest first)

`navigate_page` → `take_snapshot` (text a11y tree with uids) → act (`click`, `fill`, `press_key`) → `wait_for` text → `take_snapshot`.
Use `take_screenshot` only for visual checks — images cost far more context than snapshots.

## SSR-specific checks

- **Server HTML vs hydrated DOM.** `curl -s <url>` shows what the server sent (status, critical `<style data-critical>`, `__INITIAL_STATE__`); the snapshot shows the DOM after hydration. Content only in the snapshot is client-rendered: a problem for LCP and SEO if it is above the fold.
- **Hydration errors.** `list_console_messages` right after `navigate_page`: look for hydration mismatch warnings (dev build only) and `[router] error`. In production, recoverable errors land in `window.__recoverableErrors`.
- **Serialized state.** `evaluate_script` `() => Object.keys(window.__INITIAL_STATE__)` must list `config` plus only the slices of the route.
- **Client navigation vs full load.** Click a link (no reload): the network list should show a `/api/v1/…` request, not a document. Lazy chunks (`modal-login`, `footer`) must appear in `list_network_requests` only after the interaction or scroll that needs them.
- **Chunks per route.** On first load the network list should hold vendor, main and the route chunk (`route-*`) only.

## Gotchas

- Act by snapshot `uid`, not CSS selectors. Match buttons by visible text.
- Re-snapshot after each step: the footer renders only after `useOnVisible` fires (scroll to it), the login modal only after the click.
- React-controlled inputs: prefer `fill`; if the value doesn't stick, set it through the native setter + `input` event in `evaluate_script`.
- `evaluate_script` takes a function: `() => { ... }`.
- Console/network: `list_console_messages`, `list_network_requests` → then `get_*` for one item only.
- Performance: `performance_start_trace` / `performance_stop_trace` → `performance_analyze_insight`; `lighthouse_audit` (mobile) for a full report. Use the production server: dev numbers are meaningless. The in-process services add artificial latency, which counts in LCP.
