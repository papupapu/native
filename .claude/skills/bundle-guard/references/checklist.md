# bundle-guard checklist

Read the changed files against this list. Every item says what to look for, the fix, and the UX rule that decides whether the fix is allowed. Facts about the current code were true when this was written: open the file before quoting it.

## UX guardrails — apply to every fix

- Lazy-load only what is **below the fold** or **shown after an interaction** (modal, gallery, map, overlay). Never lazy-load content that is visible on first paint.
- A lazy piece needs: a placeholder of the **same size** (no layout shift, as `Footer` reserves its height), and a **prefetch on intent** (hover/focus/pointerdown, or after idle) when the user is likely to open it (`LoginButton` prefetches through `useModal().prefetch`). Opening must not feel slower than today.
- No visible loss of quality or function: no smaller images, no dropped features, no removed animations just for bytes.
- If a fix delays something the user does immediately, or trades UX for bytes, do not propose it as a fix. At most a NOTE with the trade-off.

## Bundle weight

| Look for | Fix | Notes |
| --- | --- | --- |
| Heavy library imported statically in a page or in the shell | `import()` with its own `webpackChunkName`, only when it is used after an interaction or below the fold | The shell and `main` load on every route. |
| New modal / overlay | Add it to `modalRegistry` (`src/app/modal/registry.ts`) as a literal `import()` with its own `modal-*` chunk name | Never a dynamic specifier: `import(`./${id}`)` bundles the whole folder. Export a `*_MARKER = '__X__'` constant from the module so `check:bundle` also greps the emitted files. |
| New below-the-fold block imported by its parent | Same pattern as `Footer` / `FooterContent`: client-only placeholder with reserved height + `useOnVisible` | `check:bundle` discovers it by itself from the `import()`. |
| A `common` cacheGroup or `chunks: 'all'` in `build/webpack.client.ts` | Do not add it | It drags lazy code back into the initial bundle (see the comment there). |
| Static import of a page module (`Page.tsx`, `slice.ts`) from `routes.ts`, the shell or `main` | Keep the page behind its route's `lazy` + `import()`; the route chunk name must match in loader, `lazy.Component` and `handle.chunk` | A page pulled into `main` grows every route. `--modules` shows it as a new `src/...` entry. |
| New npm dependency | State its gzip size (`--modules` shows source kB per package) and whether a native API or an existing dep does the job | Prefer none. A date/format helper rarely justifies a library. |
| A new package showing up as "new" in `--modules` with a big delta | Find which import brings it; import the specific entry point, or move the call to the server | Barrel imports and `import * as` defeat tree-shaking. |
| Large data placed in a slice that is listed in `handle.slices` | Keep only the fields the page renders | Slice state is serialized into the HTML and counted twice (HTML + hydration). |
| Slice serialized for a route that does not use it | `handle.slices` lists only the slices the route owns | Everything in it ships in `__INITIAL_STATE__`. |
| New global SCSS (`src/app/global.scss`) | Put it in the component's `*.module.scss` | Global CSS lands in `main` and, being critical, is inlined on every page; `main` + route CSS has a 14 KB budget (`CRITICAL_CSS_BUDGET`, a `console.warn` at boot). |
| Context provider added high in the tree | Keep it as low as possible, split state from actions | See INP. |

## LCP (largest contentful paint)

- The hero/first image or main text must be in the **server-rendered HTML**. Flag content that only exists after a client fetch (`useEffect` + fetch, a client-only placeholder on first-paint UI) → load it in the route loader and pass it down through the slice.
- Above-the-fold image: not lazy (`loading="eager"` or no `loading`), `fetchPriority="high"` on the LCP one, explicit `width`/`height`. Below-the-fold images: `loading="lazy"`, `decoding="async"`.
- `renderToPipeableStream` waits for `onShellReady` (browsers): a new `Suspense` boundary around first-paint content moves it out of the shell. Keep it inside the shell.
- No new blocking font or stylesheet in the document head. Critical CSS is inlined by `src/ssr/render.tsx`; a new `<link rel="stylesheet">` in `Document.tsx` blocks first paint.
- Third-party scripts: load after hydration or on idle; never in the head without `async`/`defer`.

## CLS (layout shift)

- Every `<img>` / `<iframe>` / video has `width` + `height` or an `aspect-ratio`.
- Every client-only or lazy piece that appears in the flow has a placeholder with the final size (`Footer` is the reference).
- Banners, cookie bars, alerts and late-loaded headers must not push content: reserve their space or overlay them.
- Content that changes size after hydration needs a fixed-size slot.

## INP (interaction latency)

- Click/keystroke handlers that do heavy work synchronously (filtering/sorting big lists, JSON parsing): defer with `startTransition`, debounce typing, or move the work off the interaction path.
- A state change in a high provider or in a selector that returns a new object each time (`useAppSelector` with an inline `.map`/`.filter`) re-renders everything below it: select primitives or memoize with `createSelector`.
- Client navigations run the loader then `fetch('/api/v1/…')`: a loader that awaits several requests in sequence makes the click feel slow; run them in parallel.
- Long lists rendered in full: paginate, or `content-visibility: auto` for long below-the-fold sections, only if it does not break anchors or in-page search.
- Listeners added in `useEffect` on `scroll`/`resize` without `passive`/throttle.

## What not to flag

- Style-only changes, copy, tests.
- Server-only code (`src/server/**`, `src/ssr/**` except what it serializes into the HTML): it does not ship to the browser.
- Lazy chunks are not in the first-load numbers; a feature already behind a lazy `import()` is not a first-load problem.
- Sub-kB gains. Report only what moves a number or a user-visible metric.
