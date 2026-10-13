import { matchRoutes } from 'react-router';
import type { RouteObject } from 'react-router';

type LazyMap = Record<string, (() => Promise<unknown>) | undefined>;

/**
 * Browser only, before `createBrowserRouter`: loads the `lazy` parts of the routes matching the
 * current URL and merges them into the route objects. The chunks are already in the page
 * (the server linked them), so this resolves from cache, and it makes the first client render
 * identical to the server markup. As a side effect the page slices register in the root reducer,
 * which has to happen before the store is created with the server state.
 */
export async function resolveLazyMatches(routes: RouteObject[], pathname: string): Promise<void> {
  const matches = matchRoutes(routes, pathname) ?? [];
  await Promise.all(
    matches.map(async ({ route }) => {
      const lazy = route.lazy as LazyMap | undefined;
      if (!lazy || typeof lazy !== 'object') return;
      const entries = await Promise.all(
        Object.entries(lazy).map(async ([key, load]) => [key, await load?.()] as const),
      );
      Object.assign(route, Object.fromEntries(entries));
      delete route.lazy;
    }),
  );
}
