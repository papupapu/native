import type { LazyLoadedSlices } from '../store/types.ts';

export interface RouteHandle {
  pageType: 'shell' | 'home' | 'listing' | 'search' | 'swpeople' | 'notfound';
  /** webpackChunkName of the route chunk: the server preloads its assets (and nothing lazier). */
  chunk?: `route-${string}`;
  /**
   * Lazy slices this route owns. Only these (plus `config`) are serialized: the root reducer is
   * shared by every request, so the store may hold slices injected by other routes' chunks, and
   * the browser has not loaded those (RTK would warn about unknown keys).
   */
  slices?: (keyof LazyLoadedSlices)[];
}
