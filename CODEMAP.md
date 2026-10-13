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
| `src/app/{AppShell.tsx,AppShell.module.scss,global.scss}` | `AppShell`: `Header` (data `HEADER_LINKS`), `<Outlet/>`, `Footer` (data `FOOTER_SECTIONS`), `ModalProvider`; `LoginButton` renders `Button` (primary variant) and opens/prefetches the `login` modal (`onPointerEnter` / `onFocus`). The only importer of `src/styles/utilities.scss` (right after `global.scss`). The module keeps only `.shell` (min-height); the rest is utility classes |
| `src/app/RouteErrorBoundary.tsx` | `RouteErrorBoundary`: 404/500 content rendered inside the shell, with `noindex` |
| `src/app/pages/notFound.ts` | `notFoundRoute`: catch-all `*`, loader always throws `data()` 404 (`Component` is an empty function only to silence a React Router warning) |
| `src/app/pages/{home,listing,search,swpeople}/` | One folder per page: `route.ts` + `slice.ts` + `Page.tsx`. Styling is utility classes in the `className`; `home` and `listing` keep a tiny `Page.module.scss` (`.cards` grid template, `.cardTitle` / `.price` font sizes), `search` and `swpeople` have none |

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
| `src/app/modal/registry.ts` | `modalRegistry`: one literal `import()` with its own `webpackChunkName` per modal (never a dynamic specifier); `ModalId`; `ModalProps` = `{ onClose, closing, onExited }`, passed by the provider and spread by every modal into `<Modal {...props}>` |
| `src/app/modal/ModalProvider.tsx` | `ModalProvider` / `useModal`: `open`, `close`, `prefetch`; imports nothing until `open`. State is `{ id, closing } \| null`: `close` only sets `closing`, the shell calls `onExited` when its exit is over and that unmounts the modal |
| `src/app/modal/LoginModal.tsx` | `LoginModal` (default export, chunk `modal-login`), carries `MODAL_MARKER`. Renders only its content inside `<Modal size="sm" title footer>`; the submit `Button` is in the footer and points at the `<form>` with `form={formId}`. No module: utility classes already loaded with the main chunk |
| `src/components/Modal/Modal.tsx` | `Modal`: the standard shell of every modal. Native `<dialog>` opened with `showModal()` (top layer, focus trap, `cancel` event = Escape, backdrop click closes). Props `size` (`sm` / `md` / `lg`, default `md`), `mobile` (`fullscreen` default / `dialog`), `title` (standard header with `h2` and close button; without it `ariaLabel` is required by the type), `footer` (action bar, absent when omitted), `closeButton` (default true; floating in the corner without header), plus `ModalProps`. `data-state` is `open` / `closing`; when `closing` it waits for `getAnimations({ subtree: true })`, calls `dialog.close()`, and the native `close` event calls `onExited`. A `[data-autofocus]` element gets the initial focus. Sets `overflow: hidden` on `<html>` while mounted. Imported only by `modal-*` chunks (stays out of main/vendor/route) |
| `src/components/Modal/Modal.module.scss` | Only what has no utility: native dialog reset, widths per `data-size`, `max-height`, the fullscreen layout below `$breakpoint-md` (100vw x 100dvh, slides up), `::backdrop`, the `@keyframes` animations on `data-state`, disabled under `prefers-reduced-motion` |
| `src/app/lazy/useOnVisible.ts` | `useOnVisible` (IntersectionObserver, `rootMargin` 300px). Currently unused: kept for future lazy-on-visible components |

## Presentational components (`src/components/`)

| Path | Role |
| --- | --- |
| `src/components/Header/{Header.tsx,Header.module.scss}` | `Header({brand, links, actions})`, type `HeaderLink`. Static, server-rendered, its CSS ships with main. Layout comes from utility classes; the module only has `.brand` (font size) |
| `src/components/Footer/Footer.tsx` | `Footer({sections})`, types `FooterSection`, `FooterLink`. Static import, server-rendered. Utility classes only, no module |
| `src/components/Button/Button.tsx` | `Button`: `variant` (`VARIANTS` map of utility classes: `primary`, `secondary`, `ghost`), optional `size` (`SIZES` map of utility classes for padding, gap and font size: `lg` default = `py-2 px-3 gap-2 fs-body`, `sm` = `py-1 px-2 gap-1 fs-small`), optional `action` (a `submit` button needs none), `type`, `form` (id of the form it submits from outside), `ariaLabel` (icon-only buttons), `label` / `children`, `iconLeft` / `iconRight`, optional `onPointerEnter` / `onFocus` (passed through to the native button). Used by `LoginButton` in `src/app/AppShell.tsx` and by the modal files (`src/components/Modal/Modal.tsx`, `src/app/modal/LoginModal.tsx`). |
| `src/components/Button/Button.module.scss` | Only what has no utility: `.button` font-family and cursor, `.icon svg` sizing, and the states (utilities have no pseudo-class variants): `.button` `:focus` / `:active` outlines, `.primary`, `.secondary`, `.ghost` `:hover` colors. `Button.tsx` adds the per-variant module class next to the `VARIANTS` utilities; the state rule overrides the resting utility on purpose (more specific) |

## Shared types and styles

| Path | Role |
| --- | --- |
| `src/shared/types.ts` | `RequestCtx` (server only), `PublicConfig` + `toPublicConfig` (the whitelist that reaches the browser), `InlineCss` (`{href, rules}` of one inlined stylesheet), `RenderModule` / `RenderOptions` (contract between Express and the SSR bundle) |
| `src/shared/manifest.ts` | `AssetManifest`: `entry` (vendor + main) and `groups` keyed by chunk name |
| `src/globals.d.ts` | `__DEV__`, CSS-module typings, `window.__INITIAL_STATE__` / `__ROUTER_DATA__` / `__recoverableErrors` |
| `src/styles/_tokens.scss` | Fake design tokens, injected into every `.scss` by `additionalData` in `build/shared.ts`. Variables and the Sass maps `$spacers`, `$colors`, `$font-sizes`, `$radii` (no CSS emitted; keys are the class-name suffixes of the utilities). `$color-brand-dark`, `$color-grey-light`, `$color-grey-dark` are hover-state colors kept out of `$colors` (no utility class uses them; only `Button.module.scss`). `$breakpoint-md` (768px) is outside the maps too (no utility; used by `Modal.module.scss`) |
| `src/styles/utilities.scss` | Global (non-module, unhashed) utility classes generated with `@each` from the token maps: `p*`/`m*`/`gap-0..5`, `color-`/`bg-`/`border-color-<token>`, the two hand-written non-token exceptions `bg-transparent` (after the `bg-` loop) and `border-color-transparent` (after the `border-color-` loop), `border*`, `fs-*`, `rounded-*`, layout helpers. No responsive variants. Emitted general to specific (`m-0` before `mb-2`; `border-color-*` after `border*`). Imported only by `src/app/AppShell.tsx`, so it ships once in `main` |

## Build (`build/`)

| Path | Role |
| --- | --- |
| `build/webpack.client.ts` | `createClientConfig`: entry `src/client/entry.tsx`, only an initial `vendor` split, `PUBLIC_PATH` `/static/`, `AssetManifestPlugin`, analyzer with `ANALYZE=1` |
| `build/webpack.server.ts` | `createServerConfig`: entry `src/ssr/render.tsx` → `dist/server/render.cjs`, `splitChunks: false` |
| `build/shared.ts` | `swcRule` (TS/JSX), `styleRule` (SCSS, CSS Modules, tokens via `additionalData`; `exportOnlyLocals` on the server), `root`, `dist` |
| `build/AssetManifestPlugin.ts` | `AssetManifestPlugin`: writes `dist/client/manifest.json` (`entry` + one group per named chunk) |
| `build/build.ts` | `npm run build`: compiles client + server, writes `dist/stats.json` (with module names: `modules`, `dependentModules`, `modulesSpace: Infinity`) |
| `build/dev.ts` | `npm run dev`: webpack dev/hot middleware inside Express, server compiler in `watch()`; `src/server/**` and `build/**` edits restart the process |
| `build/check-bundle.ts` | `npm run check:bundle`: `discoverLazy` finds every `import(/* webpackChunkName: "x" */ './File.tsx')` in `src/` with a non-`route-` chunk name; that file must stay out of main/vendor/route-* and be inside its own non-initial chunk; an exported `*_MARKER` constant in the file also gets a string grep |
| `build/bundle-compare.ts` | `npm run bundle:compare`: gzip first-load JS per `route-*` group (`dist/client/manifest.json`), shared, lazy chunks, per-module source size (`dist/stats.json`) vs the merge-base with master (`buildBaseline`: a temporary git worktree (gitignored), cached in `node_modules/.cache/bundle-guard/<sha>.json`); `judge` applies `build/bundle-budget.json`. Flags `--modules --json --base --rebuild-base --allow-stale`; exit 0 ok/warnings, 1 BLOCKER, 2 not measurable |
| `build/bundle-budget.json` | Thresholds for `bundle-compare.ts`: `delta` (route/shared warn and block, kB) and `absolute` first-load JS per route chunk name, with `default` |

## Cross-cutting coupling

- Adding a page: `route.ts`, `slice.ts`, `Page.tsx` in `src/app/pages/<id>/`, plus `src/app/routes.ts`, `src/app/types.ts` (`pageType`), `src/store/types.ts` (`LazyLoadedSlices`), `src/services/types.ts` (`Services`), `src/services/inProcess.ts`, `src/services/browser.ts`, `src/server/api/router.ts`. Steps: `docs/GUIDA.md` §8.
- The `webpackChunkName` of a route must match in the loader's `import('./slice.ts')`, in `lazy.Component` and in `handle.chunk`; the server links the assets of `handle.chunk` only.
- A new lazy chunk (modal or other) needs no registration: `build/check-bundle.ts` discovers it from the `import()` (literal specifier, non-`route-` chunk name). Export a `*_MARKER = '__X__'` constant from the module (see `src/app/modal/LoginModal.tsx`) to add the string grep.
- A new modal: a file in `src/app/modal/` that renders its content inside `<Modal {...props}>` (`src/components/Modal/Modal.tsx`) and one entry in `modalRegistry`. `Modal` must be imported only by `modal-*` chunks, never by `AppShell` or a page. Steps: `docs/GUIDA.md` §8.1.
- `RequestCtx` never reaches the browser: only `PublicConfig` does, via `toPublicConfig` and `configSlice`.
- Utility classes: a CSS property comes from a utility or from the component module, never both on the same element (route CSS is inlined after `main`, so a module wins at equal specificity). Exception: states and pseudo-classes (`:hover`, `:focus`, `:active`) live in the module and override the resting utility on purpose (see `src/components/Button/Button.module.scss`). Import `src/styles/utilities.scss` only from `src/app/AppShell.tsx`: from a page or component it would be duplicated in every route CSS. A new token that needs a class goes in a map of `src/styles/_tokens.scss`.
- Docs: `README.md` (decisions, verification), `docs/GUIDA.md` (Italian tutorial, repeats the folder tree and the webpack table).
