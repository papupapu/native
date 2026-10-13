# CODEMAP

Paths relative to the repo root. `dist/` is build output (gitignored): never read it.
Hint, not proof: open the file before stating values, line numbers or that something is missing.
Checked by `node scripts/check-ai-docs.mjs` (paths exist, backticked symbols appear in the row's files, no line numbers).

## Server (`src/server/`, runs under Node type stripping: no JSX, erasable syntax, `.ts` import extensions)

| Path | Role |
| --- | --- |
| `src/server/boot.ts` | Production entry `boot`: `loadConfig` → `readManifest` / `readCriticalCss` warm-up → `createApp` → listen, graceful shutdown on SIGTERM/SIGINT |
| `src/server/app.ts` | `createApp(deps: AppDeps)`: the Express mount order (`/status`, `/favicon.ico`, `/.well-known/appspecific`, `/api/v1`, static or `mountAssets`, cookies, headers, context, `seoRedirect`, then the `/{*splat}` render handler, then `errorHandler`) |
| `src/server/config.ts` | `loadConfig`: validated `PORT`, `NODE_ENV`, `distDir` |
| `src/server/middleware/{context,headers,seoRedirect,errors}.ts` | `requestContext` (builds `RequestCtx`: locale, bot detection, base URL, cookies, into `res.locals`), `securityHeaders`, `seoRedirect` (table of 301s, `REDIRECTS`), `errorHandler` (500 page, `res.destroy` when headers are already sent) |
| `src/server/api/router.ts` | `apiRouter`: `/api/v1/{home,search,listings/:id,swpeople/:id}`, what the browser services call on client navigations; backed by `createInProcessServices` |
| `src/server/ssr/renderer.ts` | `createRendererLoader`: loads `dist/server/render.cjs` and, in dev, reloads it when its mtime changes |
| `src/server/ssr/assets.ts` | `readManifest` (`dist/client/manifest.json`), `readCriticalCss` (CSS of `main` and every `route-*` group as `InlineCss[]` with its public href, read once at boot; `console.warn` when `main` + a route exceed `CRITICAL_CSS_BUDGET`, 14 KB) |

## SSR (`src/ssr/`, bundled by webpack into `dist/server/render.cjs`)

| Path | Role |
| --- | --- |
| `src/ssr/render.tsx` | `render`: `createStaticHandler(routes).query` → redirect passthrough → status from `result.statusCode` → `renderToPipeableStream` (`onShellReady` browsers, `onAllReady` bots, `ABORT_AFTER_MS`). Inlines the critical CSS of `main` + the route chunk and links only the other `assets.css` files (`inlineCss` / `linkedCss`). Serializes only `config` + the slices named in `handle.slices` of the matched routes. Logs `[ssr] loader error` for non-`data()` errors |
| `src/ssr/Document.tsx` | `Document`: `<html>` / `<head>` (`<style data-critical data-href>` for inlined CSS, `<link>` for the rest; the `data-href` is what the mini-css-extract runtime looks up to skip the download) / `<div id="root">`. Server only |
| `src/ssr/serialize.ts` | `serializeForScript` (safe for inline `<script>`), `toHydrationData` (router data; unexpected errors become a generic 500 without message) |

## Client (`src/client/`)

| Path | Role |
| --- | --- |
| `src/client/entry.tsx` | `main`: `resolveLazyMatches` → `makeStore` with `__INITIAL_STATE__` and `createBrowserServices` → `createBrowserRouter` with `hydrationData` → `hydrateRoot('#root')`. `logRouterError` logs `[router] error` |
| `src/app/lazy/resolveLazyMatches.ts` | `resolveLazyMatches`: loads the `lazy` parts of the matched routes before the store exists (registers the page slices) |

## Routing and pages (`src/app/`, shared by server and client bundles)

| Path | Role |
| --- | --- |
| `src/app/routes.ts` | `routes`: `root` (`AppShell`) → pathless `content` (holds `RouteErrorBoundary`) → the page routes |
| `src/app/types.ts` | `RouteHandle`: `pageType`, `chunk` (the server links its assets) and `slices` (the only ones serialized) |
| `src/app/{AppShell.tsx,AppShell.module.scss,global.scss}` | `AppShell`: header with the demo links, `<Outlet/>`, `Footer`, `ModalProvider`; `LoginButton` opens/prefetches the `login` modal |
| `src/app/RouteErrorBoundary.tsx` | `RouteErrorBoundary`: 404/500 content rendered inside the shell, with `noindex` |
| `src/app/pages/notFound.ts` | `notFoundRoute`: catch-all `*`, loader always throws `data()` 404 (`Component` is an empty function only to silence a React Router warning) |
| `src/app/pages/{home,listing,search,swpeople}/` | One folder per page: `route.ts` + `slice.ts` + `Page.tsx` + `Page.module.scss` |

| URL | Route id | Chunk | Slice / thunk | Status |
| --- | --- | --- | --- | --- |
| `/` | `home` (`homeRoute`) | `route-home` | `home` / `fetchHome` | 200 |
| `/annunci/:id` | `listing` (`listingRoute`) | `route-listing` | `listing` / `fetchListing` | loader throws `data()` 404 when the listing is null: the error boundary renders |
| `/cerca?q=` | `search` (`searchRoute`) | `route-search` | `search` / `fetchSearch` | loader returns `data()` 404 when `total === 0`: the page still renders |
| `/swpeople/:id` | `swpeople` (`swpeopleRoute`) | `route-swpeople` | `swpeople` / `fetchSwPeople` | loader throws `data()` 404 when null |
| anything else | `notfound` | none | none | 404 |

Each `route.ts` has a tiny static loader: it `await import()`s its own `slice.ts` first (same `webpackChunkName` as the `lazy.Component` import), then dispatches the thunk. `src/server/middleware/seoRedirect.ts` answers `/vecchia-url` before any route runs.

## Store (`src/store/`: one store per request on the server, one per page load in the browser)

| Path | Role |
| --- | --- |
| `src/store/makeStore.ts` | `makeStore({preloadedState, services})`: thunk `extraArgument` = `Services`; `RootState`, `AppStore`, `AppDispatch` |
| `src/store/rootReducer.ts` | `rootReducer`: `combineSlices(configSlice).withLazyLoadedSlices<LazyLoadedSlices>()`. Page slices call `injectInto(rootReducer)` when their chunk is evaluated |
| `src/store/types.ts` | `AsyncState<T>`, `LazyLoadedSlices` (a new page slice is declared here) |
| `src/store/{hooks.ts,storeContext.ts,configSlice.ts,errors.ts}` | `useAppSelector` / `useAppDispatch` / `createAppAsyncThunk`; `storeContext` (React Router context that carries the store into loaders); `configSlice` (eager, seeded from `PublicConfig`); `REQUEST_FAILED` (fixed error string, slice state is serialized into the HTML) |

## Services (`src/services/`)

| Path | Role |
| --- | --- |
| `src/services/types.ts` | `Services` contract (`home`, `listing`, `search`, `swpeople`) and the data types |
| `src/services/inProcess.ts` | `createInProcessServices(latencyMs)`: fixtures with a delay; `swpeople` calls `https://swapi.dev/api` (5 s timeout). Used by the SSR bundle and by the API router |
| `src/services/browser.ts` | `createBrowserServices`: `fetch('/api/v1/…')`, a 404 becomes `null` |
| `src/services/fixtures.ts` | `LISTINGS`, `HOME` |

## Lazy parts

| Path | Role |
| --- | --- |
| `src/app/modal/registry.ts` | `modalRegistry`: one literal `import()` with its own `webpackChunkName` per modal (never a dynamic specifier); `ModalId`, `ModalProps` |
| `src/app/modal/ModalProvider.tsx` | `ModalProvider` / `useModal`: `open`, `close`, `prefetch`; imports nothing until `open` |
| `src/app/modal/{LoginModal.tsx,LoginModal.module.scss}` | `LoginModal` (default export, chunk `modal-login`), carries `MODAL_MARKER` |
| `src/app/footer/{Footer.tsx,Footer.module.scss}` | `Footer`: client-only placeholder with reserved height, `import()` of `FooterContent` when `useOnVisible` fires |
| `src/app/footer/{FooterContent.tsx,FooterContent.module.scss}` | `FooterContent` (chunk `footer`), carries `FOOTER_MARKER` |
| `src/app/lazy/useOnVisible.ts` | `useOnVisible` (IntersectionObserver, `rootMargin` 300px) |

## Shared types and styles

| Path | Role |
| --- | --- |
| `src/shared/types.ts` | `RequestCtx` (server only), `PublicConfig` + `toPublicConfig` (the whitelist that reaches the browser), `InlineCss` (`{href, rules}` of one inlined stylesheet), `RenderModule` / `RenderOptions` (contract between Express and the SSR bundle) |
| `src/shared/manifest.ts` | `AssetManifest`: `entry` (vendor + main) and `groups` keyed by chunk name |
| `src/globals.d.ts` | `__DEV__`, CSS-module typings, `window.__INITIAL_STATE__` / `__ROUTER_DATA__` / `__recoverableErrors` |
| `src/styles/_tokens.scss` | Fake design tokens, injected into every `.scss` by `additionalData` in `build/shared.ts` |

## Build (`build/`)

| Path | Role |
| --- | --- |
| `build/webpack.client.ts` | `createClientConfig`: entry `src/client/entry.tsx`, only an initial `vendor` split, `PUBLIC_PATH` `/static/`, `AssetManifestPlugin`, analyzer with `ANALYZE=1` |
| `build/webpack.server.ts` | `createServerConfig`: entry `src/ssr/render.tsx` → `dist/server/render.cjs`, `splitChunks: false` |
| `build/shared.ts` | `swcRule` (TS/JSX), `styleRule` (SCSS, CSS Modules, tokens via `additionalData`; `exportOnlyLocals` on the server), `root`, `dist` |
| `build/AssetManifestPlugin.ts` | `AssetManifestPlugin`: writes `dist/client/manifest.json` (`entry` + one group per named chunk) |
| `build/build.ts` | `npm run build`: compiles client + server, writes `dist/stats.json` |
| `build/dev.ts` | `npm run dev`: webpack dev/hot middleware inside Express, server compiler in `watch()`; `src/server/**` and `build/**` edits restart the process |
| `build/check-bundle.ts` | `npm run check:bundle`: `LAZY` lists the modules and markers that must stay out of main/vendor/route-* and inside `modal-login` / `footer` |

## Cross-cutting coupling

- Adding a page: `route.ts`, `slice.ts`, `Page.tsx` in `src/app/pages/<id>/`, plus `src/app/routes.ts`, `src/app/types.ts` (`pageType`), `src/store/types.ts` (`LazyLoadedSlices`), `src/services/types.ts` (`Services`), `src/services/inProcess.ts`, `src/services/browser.ts`, `src/server/api/router.ts`. Steps: `docs/GUIDA.md` §8.
- The `webpackChunkName` of a route must match in the loader's `import('./slice.ts')`, in `lazy.Component` and in `handle.chunk`; the server links the assets of `handle.chunk` only.
- A new lazy modal or footer-like chunk needs its entry in `LAZY` in `build/check-bundle.ts`, or the leak check does not cover it.
- `RequestCtx` never reaches the browser: only `PublicConfig` does, via `toPublicConfig` and `configSlice`.
- Docs: `README.md` (decisions, verification), `docs/GUIDA.md` (Italian tutorial, repeats the folder tree and the webpack table).
