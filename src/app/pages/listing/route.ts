import { data } from 'react-router';
import type { RouteObject } from 'react-router';
import { storeContext } from '../../../store/storeContext.ts';
import type { RouteHandle } from '../../types.ts';

const handle: RouteHandle = { pageType: 'listing', chunk: 'route-listing', slices: ['listing'] };

export const listingRoute: RouteObject = {
  id: 'listing',
  path: 'annunci/:id',
  handle,
  async loader({ context, params }) {
    const { fetchListing } = await import(/* webpackChunkName: "route-listing" */ './slice.ts');
    const listing = await context.get(storeContext).dispatch(fetchListing(params['id'] ?? '')).unwrap();
    // The thrown response decides the HTTP status on the server and renders the error boundary.
    if (!listing) throw data(null, { status: 404, statusText: 'Not Found' });
    return null;
  },
  lazy: {
    Component: async () => (await import(/* webpackChunkName: "route-listing" */ './Page.tsx')).Page,
  },
};
