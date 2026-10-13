# portal (PoC)

Architecture-only replica of the portal18 server + SSR on the 2026 stack: Node 24, Express 5, React 19,
React Router 8 (data mode), Redux Toolkit 2, webpack 5, TypeScript 6. Four pages (home, listing, search, swpeople), a fake
fetch that fills the store (`swpeople` calls the public `https://swapi.dev/api`, 5 s timeout), code splitting, a lazy modal and a lazy footer. No shared-* packages, fake
SCSS tokens.

> Nuovo? Parti da [docs/GUIDA.md](docs/GUIDA.md): architettura, server vs client, routing, data fetch e come aggiungere una pagina.

```
npm install
npm run dev            # http://localhost:3000 (PORT=… to change), HMR + SSR reload
npm run build          # dist/client, dist/server/render.cjs, dist/stats.json
npm run check:bundle   # fails if modal/footer code leaks into main/vendor/route-*
npm start              # production server (needs a build)
npm run analyze        # build + dist/bundle-report.html
npm run typecheck
```

## Layout

| Path | What |
| --- | --- |
| `src/server/` | Express app. Runs directly under Node type stripping (`node src/server/boot.ts`): `.ts` import extensions, erasable syntax only, no JSX. `boot.ts` = config → warm-up → listen → graceful shutdown. Mount order mirrors portal18. |
| `src/ssr/` | JSX side of SSR (`render.tsx`, `Document.tsx`). Bundled by webpack into one CJS file, `dist/server/render.cjs`, loaded by `server/ssr/renderer.ts`. |
| `src/app/` | Routes, shell, pages (`pages/<id>/{route,slice,Page}`), modal, footer, lazy helpers. Shared by server and client bundles. |
| `src/store/` | `makeStore()` per request, `combineSlices().withLazyLoadedSlices()`, typed hooks. |
| `src/services/` | Fake fetch (50 ms + fixtures), used in-process by the loaders (no loopback HTTP) and by `/api/v1` for the browser. |
| `build/` | webpack configs (Rspack-compatible shape), `AssetManifestPlugin`, `dev.ts`, `check-bundle.ts`. |

## How a request works

1. `/status`, `/favicon.ico`, `/.well-known/appspecific` (plain 404: Chrome DevTools probe, no render), `/api/v1`, static, cookies, headers, `requestContext`, `seoRedirect`, then the catch-all render.
2. `makeStore({preloadedState: {config}})` per request, put in a React Router `RouterContextProvider`.
3. `createStaticHandler(routes).query(request)`: the route loaders (static, in the main bundle) first
   `await import()` the page chunk, so its slice is injected before the thunk runs, then dispatch the fake fetch.
4. A `Response` result (redirect) is sent as is. Otherwise the status is decided **before** the first byte.
5. `renderToPipeableStream`: `onShellReady` for browsers, `onAllReady` for bots, `onShellError` → Express error handler, abort after 10 s.
6. State (`config` + the slices of the matched routes only) and router data go in `bootstrapScriptContent`, serialized with `serialize-javascript`. Cookies never reach the page.
7. Client: resolve the lazy parts of the matched routes → `makeStore({preloadedState})` → `createBrowserRouter(hydrationData)` → `hydrateRoot(#root)`. Loaders do not run again on hydration.

## Decisions and deviations from the plan

- **Hydrate `#root`, not the document.** `Document` is server-only; the browser never owns `<html>`.
- **`hydrate={false}` + own hydration globals** (`__INITIAL_STATE__`, `__ROUTER_DATA__`). The shape works; errors are serialized as `{status, statusText, internal: false, data}`.
- **The loader awaits its chunk.** The loader stays tiny and static, but starts with `await import(/* webpackChunkName: "route-x" */ './slice.ts')` (same name as the lazy `Component`) so the slice exists before the thunk and before the store is built on the client.
- **css-loader 7** exports named by default: `namedExport: false` + `exportLocalsConvention: 'as-is'` so CSS Modules are `styles['name']`. The server uses `exportOnlyLocals`.
- **Critical CSS**: the `main` and `route-*` stylesheets are read once at boot and inlined as `<style data-critical data-href="/static/…css">`; inlined files are **not** linked, so the first paint does not wait for a `.css`. `data-href` carries the file's public URL: the mini-css-extract-plugin runtime looks for a `<link>` or `<style>` with it before downloading a chunk's CSS, so hydration and client navigation back to the same route do not refetch it. Boot warns when `main` + a route exceed `CRITICAL_CSS_BUDGET` (14 KB); warning only. Not inlined in dev (links only). How to keep below-the-fold CSS out of it: `docs/GUIDA.md` §10.
- **The footer is lazy and client-only.** The server renders an empty placeholder with reserved height (no footer links, no footer CSS in the HTML); the footer chunk (JS + CSS) is requested when the placeholder gets within 300 px of the viewport (`IntersectionObserver`). Fine for a PoC of lazy page portions; a footer with SEO links needs SSR and would not follow this pattern. A variant with SSR + deferred hydration ("B") was built and removed: see the warning below.
- **The `notfound` route has an empty `Component`** only to silence React Router's "leaf route without element" warning (the loader always throws, so it is never rendered). `/.well-known/appspecific/*` is answered 404 before SSR for the same probe.
- **Status from the fetch result (`/cerca?q=…`).** The search loader *returns* `data(null, {status: 404})` when the query has 0 results: the page still renders (shell, form, footer) and the static handler uses that as `statusCode` (React Router: a non-200 status of a returned `data()` counts only if no loader threw). A `throw data(…)` instead renders the error boundary, which is what `/annunci/404` wants. The status only matters for the server render (first load, bots); client navigations ignore it. The empty page also gets `noindex`.
- **Rejected thunks never leak their message.** Slices store the fixed `REQUEST_FAILED` (`src/store/errors.ts`) instead of `action.error.message`, because slice state is serialized into the HTML. The real error is logged on the server by `render.tsx` (`[ssr] loader error in "content"`: the id of the route holding the error boundary); on client navigations `RouterProvider`'s `onError` (`src/client/entry.tsx`) logs `[router] error` in the browser console. Expected `data()`/404 responses are not logged.
- **`main { min-height: 250vh }`** is deliberate: the home page is too short otherwise and the footer is always within the 300 px observer margin.
- **No `webpack-dev-server`**: `webpack-dev-middleware` + `webpack-hot-middleware` + React Refresh inside the same Express app. Server compiler in `watch()` writing to disk. `src/server/**` and `build/**` edits restart the process (`node --watch-path`).

## Lazy footer: what to avoid

A first attempt at a footer rendered by the server and hydrated late was a `<Suspense>` boundary whose child did `use(promise)`, resolved when the footer got near the viewport, so React kept the server HTML dehydrated. It hydrated cleanly and the footer chunk loaded only on scroll, but **client navigation was broken until the footer chunk had loaded**: the URL changed and the data was fetched, but the page did not update. Cause (react-dom `updateDehydratedSuspenseComponent`): a dehydrated boundary that is still pending and receives an update calls `renderDidSuspendDelayIfPossible()`, which delays the whole router transition. Do not gate content with a never-resolving `use()` inside the shell: any pending boundary that the shell re-renders through blocks every navigation. The lazy footer now is the plain client-only one (placeholder, then `import()` on visibility), which is not affected.

## Verification (production build unless noted)

| Check | Result |
| --- | --- |
| `curl /` has fixture data in the HTML | ok |
| 404 for unknown route and unknown listing id; 301 + `Location` on the old URL | ok |
| Cookie leak (`Cookie: s=SECRET`) | 0 occurrences |
| Serialized state limited to `config` + matched slices | ok |
| Zero recoverable hydration errors, empty console (home, listing, 404 state) | ok |
| Client navigation without a full reload: home → listing → 404 → home, browser back/forward, with the footer still unloaded (dev and prod) | ok |
| `check:bundle`: no `LoginModal`/`FooterContent` module or marker in main/vendor/route-*; lazy chunks exist and contain them | 30 ok, 0 failed |
| Network on load: only vendor, main, route-*; no modal, no footer JS | ok |
| Modal: `modal-login` requested on hover (prefetch) or on click, never before | ok (checked with and without hover) |
| Search: `/cerca?q=milano` 200, `/cerca?q=zzz` 404 with the full search page in the HTML (form, `noindex`), `/cerca` 200 | ok (curl, prod) |
| Search, client side: empty ↔ non-empty queries via link and `<Form>`, back/forward, no full reload; full load of `/cerca?q=zzz` hydrates (document status 404). The only console message is Chrome's own "404" for the document | ok (prod) |
| Footer: no JS/CSS in the page at load and at 300 px, JS + CSS at 900 px; footer links work, header navigation and back keep the footer, zero console messages | ok (prod, Chrome headless) |
| Unexpected loader error (service throwing): first load → 500, no message in the HTML, `[ssr] loader error` with stack in the server log (prod and dev); client navigation → 500 page and `[router] error` in the browser console | ok (temporary throwing service, not committed) |
| Dev: HMR of a component, no reload | ~200 ms (one measurement) |
| Dev: UI edit visible in SSR output without restart | ok |
| Dev: `src/server` edit live without a manual restart | ~2 s |

Sizes (gzip): vendor 107.6 KB, main 4.2 KB, route-home 0.9 KB, route-listing 0.8 KB, route-search 1.0 KB, route-swpeople 0.8 KB, modal-login 0.6 KB, footer 0.5 KB. Full build ≈ 3 s.

## Not done

- **Rspack** was not measured (build is already ~3 s with webpack; the config is kept simple enough to try).
- No Dockerfile, no Playwright suite (the checks above were run by hand with curl and Chrome DevTools). "Navigate before the footer is loaded" in particular deserves an e2e test.
- Known gaps found in review, left as is in the PoC: loaders do not pass `request.signal` (a slow stale response can overwrite `listing.data`); a failed modal chunk load is thrown to the router's default error page (the root route has no error boundary); a failed footer `import()` is not retried; `dist/server` is shared by dev and prod builds, so run `npm run build` before `npm start`.
- Only one HMR timing sample; no FOUC / first-paint test with throttled network (the inline critical CSS, no longer render-blocked by a `<link>`, is what should prevent it). The `data-href` lookup of the CSS runtime was checked by hand in Chrome (prod build, cache disabled): no `main`/`route-home` CSS request on `/`, and home → listing → home only requests `route-listing`'s CSS. `npm run smoke` only verifies that `main*.js` contains the string `data-href`.
- SSR is anonymous and has no device detection, as in portal18.
