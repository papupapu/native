import { data } from 'react-router';
import type { RouteObject } from 'react-router';
import { storeContext } from '../../../store/storeContext.ts';
import type { RouteHandle } from '../../types.ts';

const handle: RouteHandle = { pageType: 'search', chunk: 'route-search', slices: ['search'] };

export const searchRoute: RouteObject = {
  id: 'search',
  path: 'cerca',
  handle,
  async loader({ context, request }) {
    const { fetchSearch } = await import(/* webpackChunkName: "route-search" */ './slice.ts');
    const query = new URL(request.url).searchParams.get('q') ?? '';
    const result = await context.get(storeContext).dispatch(fetchSearch(query)).unwrap();
    // Zero results: the page is still the normal search page (so it is *returned*, not thrown,
    // which would render the error boundary instead), only the HTTP status becomes 404. The static
    // handler reads it from the returned `data()` (`statusCode`); the browser ignores it.
    return result.total === 0 ? data(null, { status: 404, statusText: 'Not Found' }) : null;
  },
  lazy: {
    Component: async () => (await import(/* webpackChunkName: "route-search" */ './Page.tsx')).Page,
  },
};
