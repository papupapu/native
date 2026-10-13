import type { RouteObject } from 'react-router';
import { storeContext } from '../../../store/storeContext.ts';
import type { RouteHandle } from '../../types.ts';

const handle: RouteHandle = { pageType: 'home', chunk: 'route-home', slices: ['home'] };

/**
 * The loader lives in the main bundle and is tiny; the slice and the page sit in the
 * `route-home` chunk. The loader awaits that chunk first, so the slice is always injected
 * before the thunk runs, whatever order the router resolves `lazy` and `loader` in.
 */
export const homeRoute: RouteObject = {
  id: 'home',
  index: true,
  handle,
  async loader({ context }) {
    const { fetchHome } = await import(/* webpackChunkName: "route-home" */ './slice.ts');
    await context.get(storeContext).dispatch(fetchHome()).unwrap();
    return null;
  },
  lazy: {
    Component: async () => (await import(/* webpackChunkName: "route-home" */ './Page.tsx')).Page,
  },
};
