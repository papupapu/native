# portal (PoC)

Architecture-only replica of the portal18 server + SSR on the 2026 stack: Node 24, Express 5, React 19,
React Router 8 (data mode), Redux Toolkit 2, webpack 5, TypeScript 6. Four pages (home, listing, search, swpeople), a fake
fetch that fills the store (`swpeople` calls the public `https://swapi.dev/api`, 5 s timeout), code splitting and a lazy modal. No shared-* packages, fake
SCSS tokens.

> Nuovo? Parti da [docs/GUIDA.md](docs/GUIDA.md): architettura, server vs client, routing, data fetch e come aggiungere una pagina.

```
npm install
npm run dev            # http://localhost:3000 (PORT=… to change), HMR + SSR reload
npm run build          # dist/client, dist/server/render.cjs, dist/stats.json
npm run check:bundle   # fails if a lazy part (modal, any non-route import()) leaks into main/vendor/route-*
npm run bundle:compare # first-load JS per route vs the merge-base, judged by build/bundle-budget.json (needs a build)
npm start              # production server (needs a build)
npm run analyze        # build + dist/bundle-report.html
npm run typecheck
```

## Layout

| Path | What |
| --- | --- |
| `src/server/` | Express app. Runs directly under Node type stripping (`node src/server/boot.ts`): `.ts` import extensions, erasable syntax only, no JSX. `boot.ts` = config → warm-up → listen → graceful shutdown. Mount order mirrors portal18. |
| `src/ssr/` | JSX side of SSR (`render.tsx`, `Document.tsx`). Bundled by webpack into one CJS file, `dist/server/render.cjs`, loaded by `server/ssr/renderer.ts`. |
| `src/app/` | Routes, shell (holds the header/footer data), pages (`pages/<id>/{route,slice,Page}`), modal, lazy helpers. Shared by server and client bundles. |
| `src/components/` | Reusable presentational components (`Header`, `Footer`, `Button`): props in, markup out; static imports, server-rendered. `Modal` (the modal shell) lives here too but is imported only by the lazy `modal-*` chunks. |
| `src/store/` | `makeStore()` per request, `combineSlices().withLazyLoadedSlices()`, typed hooks. |
| `src/services/` | Fake fetch (50 ms + fixtures), used in-process by the loaders (no loopback HTTP) and by `/api/v1` for the browser. |
| `build/` | webpack configs (Rspack-compatible shape), `AssetManifestPlugin`, `dev.ts`, `check-bundle.ts`, `bundle-compare.ts` + `bundle-budget.json`. |

## How a request works

1. `/status`, `/favicon.ico`, `/.well-known/appspecific` (plain 404: Chrome DevTools probe, no render), `/api/v1`, static, cookies, headers, `requestContext`, `seoRedirect`, `compression`, then the catch-all render.
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
- **Critical CSS**: the `main` and `route-*` stylesheets are read once at boot and inlined as `<style data-critical data-href="/static/…css">`; inlined files are **not** linked, so the first paint does not wait for a `.css`. `data-href` carries the file's public URL: the mini-css-extract-plugin runtime looks for a `<link>` or `<style>` with it before downloading a chunk's CSS, so hydration and client navigation back to the same route do not refetch it. Boot warns when `main` + a route exceed `CRITICAL_CSS_BUDGET` (14 KB); warning only. Not inlined in dev (links only). How to keep below-the-fold CSS out of it: `docs/GUIDA.md` §10. With the utility classes below, `main` is about 4.3 KB (it was about 1.1 KB) and `main` + a route is about 4.3-4.5 KB.
- **Utility classes from the tokens.** `src/styles/_tokens.scss` has Sass maps (`$spacers`, `$colors`, `$font-sizes`, `$radii`); `src/styles/utilities.scss` generates global, unhashed classes from them with `@each` (`p-3`, `mb-2`, `gap-2`, `color-text-muted`, `bg-brand`, `border-color-border`, `fs-small`, `rounded-1`, plus layout helpers like `flex`, `items-center`, `max-w-page`). No responsive variants. Only `AppShell.tsx` imports it, so it ships once in `main` (about 3.9 KB, 1.29 KB gzip); importing it from a page or component would repeat it in every route CSS. Rule: a CSS property comes from a utility **or** from the component's module, never both on the same element, because route CSS is inlined after `main` and a module would silently win at equal specificity. Exception: states (`:hover`, `:focus`, `:active`) live in the module and override the resting utility on purpose, since utilities have no pseudo-class variants (`Button`; its three hover colors are Sass variables outside the maps). Modules keep only what has no token or utility (grid templates, `position`/`inset`, `rgba`, `min()` widths, font sizes outside the scale, `cursor`, descendant `svg` sizing). Utilities are emitted general to specific (`m-0` before `mb-2`), so combining them works. Modules left: AppShell, Header, Button, Modal, `home`, `listing` (`LoginModal` has none: it only renders content inside `Modal`). First-load JS grew 0.13-0.20 KB gzip per route; computed styles of `/`, `/annunci/1`, `/cerca?q=milano` and the login modal were compared in Chrome before and after: identical.
- **Modals share one shell.** `src/components/Modal/Modal.tsx` wraps a native `<dialog>` opened with `showModal()`: top layer, focus trap and inert page come from the browser, Escape arrives as the `cancel` event (prevented, so the exit animation is not skipped), a click on the backdrop closes. Props: `size` (`sm`/`md`/`lg` = 400/560/800px, default `md`), `mobile` (`fullscreen` default, or `dialog`; below `$breakpoint-md` = 768px fullscreen is 100vw x 100dvh and slides up from the bottom), `title` (standard header with `h2` and close button; without it `ariaLabel` is required by the type), `footer` (standard action bar, absent when omitted), `closeButton` (default true). Height follows the content; the body scrolls beyond the viewport. Enter/exit are CSS `@keyframes` keyed on `data-state` (`open` / `closing`), off under `prefers-reduced-motion`. An element with `data-autofocus` gets the initial focus. Page scroll is locked while open (`overflow: hidden` on `<html>`). Lifecycle: `ModalProvider` state is `{ id, closing } | null`; `close()` only sets `closing`; the shell waits for `dialog.getAnimations({ subtree: true })`, calls `dialog.close()`, and the native `close` event calls `onExited`, which unmounts the modal. `ModalProps` (`registry.ts`) is `{ onClose, closing, onExited }` and a modal spreads it into `<Modal {...props}>`. Only `modal-*` chunks import the shell, so it stays out of main/vendor/route.
- **Header and footer are static.** `Header` and `Footer` (`src/components/`) are plain imports of `AppShell`: server-rendered in the HTML (footer links are crawlable) and their CSS is in `main`. The only lazy part is the modal (`modal-login`). `useOnVisible` is kept for future lazy-on-visible components but nothing uses it now. Two lazy-footer experiments (client-only placeholder, SSR + deferred hydration) were removed: see the note below.
- **The `notfound` route has an empty `Component`** only to silence React Router's "leaf route without element" warning (the loader always throws, so it is never rendered). `/.well-known/appspecific/*` is answered 404 before SSR for the same probe.
- **Status from the fetch result (`/cerca?q=…`).** The search loader *returns* `data(null, {status: 404})` when the query has 0 results: the page still renders (shell, form, footer) and the static handler uses that as `statusCode` (React Router: a non-200 status of a returned `data()` counts only if no loader threw). A `throw data(…)` instead renders the error boundary, which is what `/annunci/404` wants. The status only matters for the server render (first load, bots); client navigations ignore it. The empty page also gets `noindex`.
- **Rejected thunks never leak their message.** Slices store the fixed `REQUEST_FAILED` (`src/store/errors.ts`) instead of `action.error.message`, because slice state is serialized into the HTML. The real error is logged on the server by `render.tsx` (`[ssr] loader error in "content"`: the id of the route holding the error boundary); on client navigations `RouterProvider`'s `onError` (`src/client/entry.tsx`) logs `[router] error` in the browser console. Expected `data()`/404 responses are not logged.
- **HTML is compressed by the app, assets are not.** `compression()` (`src/server/app.ts`) is mounted after `seoRedirect` and before the render handler, so it only covers what the SSR handler sends (pages, SSR redirects, the 500 page). `/status`, `/api/v1` and the static assets (or webpack-dev-middleware in dev) are mounted above it and stay uncompressed: a CDN or reverse proxy is expected to compress them. It negotiates gzip/br/deflate from `Accept-Encoding` and adds `Vary: Accept-Encoding`. No page uses Suspense today, so the shell is the whole document. `compression` also provides `res.flush()`, which React calls after each chunk written by `stream.pipe(res)`: a safeguard, so that if a Suspense boundary is ever added the gzip buffer does not hold its content back (checked with a throwaway server, not with a page of this repo). Measured on `/`: 9706 B identity, 3072 B gzip, 2965 B br. Found with the DevTools performance insight "DocumentLatency".
- **No `webpack-dev-server`**: `webpack-dev-middleware` + `webpack-hot-middleware` + React Refresh inside the same Express app. Server compiler in `watch()` writing to disk. `src/server/**` and `build/**` edits restart the process (`node --watch-path`).

## Never gate shell content with a pending `use()`

Historical note. An earlier lazy footer was a `<Suspense>` boundary whose child did `use(promise)`, resolved when the footer got near the viewport, so React kept the server HTML dehydrated. **Client navigation was broken until that promise resolved**: the URL changed and the data was fetched, but the page did not update. Cause (react-dom `updateDehydratedSuspenseComponent`): a dehydrated boundary that is still pending and receives an update calls `renderDidSuspendDelayIfPossible()`, which delays the whole router transition. Do not gate content with a never-resolving `use()` inside the shell: any pending boundary that the shell re-renders through blocks every navigation. The footer is no longer lazy.

## Verification (production build unless noted)

| Check | Result |
| --- | --- |
| `curl /` has fixture data in the HTML | ok |
| 404 for unknown route and unknown listing id; 301 + `Location` on the old URL | ok |
| Cookie leak (`Cookie: s=SECRET`) | 0 occurrences |
| Serialized state limited to `config` + matched slices | ok |
| Zero recoverable hydration errors, empty console (home, listing, 404 state) | ok |
| Client navigation without a full reload: home → listing → 404 → home, browser back/forward (dev and prod) | ok |
| `check:bundle`: lazy parts discovered from the `import()` calls (`LoginModal`): no module or marker in main/vendor/route-*; its chunk exists, is not initial and contains it | 17 ok, 0 failed (after the footer removal) |
| `bundle:compare`: growth vs the merge-base and first-load JS per route within `build/bundle-budget.json` | exit 0 = ok/warnings, 1 = BLOCKER, 2 = not measurable |
| Network on load: only vendor, main, route-*; no modal JS | ok |
| `/` has header and footer (with their links) in the SSR HTML (`npm run smoke`) | ok (`npm run smoke`, 27 checks) |
| `/` is compressed when the client accepts it, and not with `Accept-Encoding: identity` (`npm run smoke`) | ok |
| Modal: `modal-login` requested on hover (prefetch) or on click, never before | ok (checked with and without hover) |
| Search: `/cerca?q=milano` 200, `/cerca?q=zzz` 404 with the full search page in the HTML (form, `noindex`), `/cerca` 200 | ok (curl, prod) |
| Search, client side: empty ↔ non-empty queries via link and `<Form>`, back/forward, no full reload; full load of `/cerca?q=zzz` hydrates (document status 404). The only console message is Chrome's own "404" for the document | ok (prod) |
| Unexpected loader error (service throwing): first load → 500, no message in the HTML, `[ssr] loader error` with stack in the server log (prod and dev); client navigation → 500 page and `[router] error` in the browser console | ok (temporary throwing service, not committed) |
| Dev: HMR of a component, no reload | ~200 ms (one measurement) |
| Dev: UI edit visible in SSR output without restart | ok |
| Dev: `src/server` edit live without a manual restart | ~2 s |

Sizes (gzip, with the static header/footer): vendor + main 108.9 KB, route-home 0.9 KB, route-listing 0.8 KB, route-search 0.9 KB, route-swpeople 0.8 KB, modal-login 1.3 KB (it carries the `Modal` shell and its CSS). Full build ≈ 3 s.

## Not done

- **Rspack** was not measured (build is already ~3 s with webpack; the config is kept simple enough to try).
- No Dockerfile, no Playwright suite (the checks above were run by hand with curl and Chrome DevTools).- Known gaps found in review, left as is in the PoC: loaders do not pass `request.signal` (a slow stale response can overwrite `listing.data`); a failed modal chunk load is thrown to the router's default error page (the root route has no error boundary); `dist/server` is shared by dev and prod builds, so run `npm run build` before `npm start`.
- Only one HMR timing sample; no FOUC / first-paint test with throttled network (the inline critical CSS, no longer render-blocked by a `<link>`, is what should prevent it). The `data-href` lookup of the CSS runtime was checked by hand in Chrome (prod build, cache disabled): no `main`/`route-home` CSS request on `/`, and home → listing → home only requests `route-listing`'s CSS. `npm run smoke` only verifies that `main*.js` contains the string `data-href`.
- SSR is anonymous and has no device detection, as in portal18.
