# portal

SSR portal PoC (Express 5, React 19, React Router data mode, Redux Toolkit, webpack 5). Decisions and verification: `README.md`. Tutorial (Italian): `docs/GUIDA.md`.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run typecheck`, `npm run check:bundle` (after `build`: every lazy part, discovered from the `import()` calls with a non-`route-` `webpackChunkName`, must stay out of main/vendor/route chunks; nothing to register)
- `npm run bundle:compare -- --modules` (after `build`): first-load JS per route vs the merge-base, judged by `build/bundle-budget.json`. Run it before a PR that touches `src/` client code or `package.json`; the `bundle-guard` skill wraps it. `chrome-devtools` skill: runtime checks in a real browser (`.mcp.json`)
- `npm run smoke`: boots the production server on a free port and checks status codes, HTML content, serialized state, redirects and `/api/v1` (needs `npm run build` first). Run it after any change to routes, loaders, slices, `src/server` or `src/ssr`. `node scripts/smoke.mjs --start --network` also checks `/swpeople` (calls swapi.dev). Add a check there when you add a page or change a status code.
- `node scripts/check-ai-docs.mjs`: validates `CODEMAP.md` against the code. Run it after editing the AI docs.
- `node scripts/test-hooks.mjs`: run it after editing `.claude/hooks/**`.

## Finding code

Read `CODEMAP.md` first. For "where is X handled" or "which files implement Y" use the `code-locator` agent instead of Explore. `dist/` is bundled output: never read it.

## Docs

At the end of a task that changed behavior or structure, delegate **once** to the `docs-updater` agent with a short summary and the list of changed files.

| Fact | Where |
| --- | --- |
| File roles, URL → route → chunk → slice, coupling | `CODEMAP.md` |
| Decisions, request flow, verification | `README.md` |
| Tutorial, folder tree, steps to add a page | `docs/GUIDA.md` (Italian) |
| Commands, conventions | this file |

## Server code

`src/server` runs under Node type stripping: no JSX, only erasable syntax, `.ts` import extensions. Details: `README.md` and `docs/GUIDA.md` §4.
