import type { RouteObject } from 'react-router';
import { AppShell } from './AppShell.tsx';
import { homeRoute } from './pages/home/route.ts';
import { listingRoute } from './pages/listing/route.ts';
import { searchRoute } from './pages/search/route.ts';
import { swpeopleRoute } from './pages/swpeople/route.ts';
import { notFoundRoute } from './pages/notFound.ts';
import { RouteErrorBoundary } from './RouteErrorBoundary.tsx';
import type { RouteHandle } from './types.ts';

const shellHandle: RouteHandle = { pageType: 'shell' };

/**
 * `root` is the persistent shell. `content` is a pathless layout whose only job is to hold the
 * ErrorBoundary: errors (404 included) render inside the shell instead of replacing it.
 */
export const routes: RouteObject[] = [
  {
    id: 'root',
    path: '/',
    Component: AppShell,
    handle: shellHandle,
    children: [
      {
        id: 'content',
        ErrorBoundary: RouteErrorBoundary,
        children: [homeRoute, listingRoute, searchRoute, swpeopleRoute, notFoundRoute],
      },
    ],
  },
];
