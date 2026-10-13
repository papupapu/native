import { data } from 'react-router';
import type { RouteObject } from 'react-router';
import { storeContext } from '../../../store/storeContext.ts';
import type { RouteHandle } from '../../types.ts';

const handle: RouteHandle = { pageType: 'swpeople', chunk: 'route-swpeople', slices: ['swpeople'] };

export const swpeopleRoute: RouteObject = {
  id: 'swpeople',
  path: 'swpeople/:id',
  handle,
  async loader({ context, params }) {
    const { fetchSwPeople } = await import(/* webpackChunkName: "route-swpeople" */ './slice.ts');
    const swpeople = await context.get(storeContext).dispatch(fetchSwPeople(params['id'] ?? '')).unwrap();
    // The thrown response decides the HTTP status on the server and renders the error boundary.
    if (!swpeople) throw data(null, { status: 404, statusText: 'Not Found' });
    return null;
  },
  lazy: {
    Component: async () => (await import(/* webpackChunkName: "route-swpeople" */ './Page.tsx')).Page,
  },
};
