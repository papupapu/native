import { data } from 'react-router';
import type { RouteObject } from 'react-router';
import type { RouteHandle } from '../types.ts';

const handle: RouteHandle = { pageType: 'notfound' };

/**
 * Catch-all: a loader that throws makes the static handler answer 404 and render the boundary.
 * `Component` is never rendered (the loader always throws) but React Router warns about a leaf
 * route without an element, once per 404 request, so it gets an empty one.
 */
export const notFoundRoute: RouteObject = {
  id: 'notfound',
  path: '*',
  handle,
  Component: () => null,
  loader() {
    throw data(null, { status: 404, statusText: 'Not Found' });
  },
};
