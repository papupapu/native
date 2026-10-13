import { StrictMode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createBrowserRouter, isRouteErrorResponse, RouterContextProvider } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { resolveLazyMatches } from '../app/lazy/resolveLazyMatches.ts';
import { routes } from '../app/routes.ts';
import { createBrowserServices } from '../services/browser.ts';
import { makeStore } from '../store/makeStore.ts';
import type { RootState } from '../store/makeStore.ts';
import { storeContext } from '../store/storeContext.ts';

/**
 * Client counterpart of the `[ssr] loader error` log in `src/ssr/render.tsx`: the error boundary only
 * shows a generic page, so without this a failing loader on a client navigation leaves no trace in the
 * console. Expected `data()` responses (404 …) are not errors.
 */
function logRouterError(error: unknown) {
  if (!isRouteErrorResponse(error)) console.error('[router] error', error);
}

async function main() {
  const preloadedState = window.__INITIAL_STATE__ as Partial<RootState> | undefined;
  const hydrationData = window.__ROUTER_DATA__;
  delete window.__INITIAL_STATE__;
  delete window.__ROUTER_DATA__;

  // 1. Load the matched route chunks: pages register their slices in the root reducer.
  await resolveLazyMatches(routes, window.location.pathname);

  // 2. Only now create the store: `combineReducers` drops preloaded keys it does not know yet.
  const store = makeStore({ preloadedState, services: createBrowserServices() });

  // 3. The router starts with the server's loader data, so no loader runs for the first render.
  const router = createBrowserRouter(routes, {
    hydrationData,
    getContext() {
      const context = new RouterContextProvider();
      context.set(storeContext, store);
      return context;
    },
  });

  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <Provider store={store}>
        <RouterProvider router={router} onError={logRouterError} />
      </Provider>
    </StrictMode>,
    {
      onRecoverableError(error) {
        // Any hydration mismatch ends up here: tests assert that this stays empty.
        (window.__recoverableErrors ??= []).push(String(error));
        console.error('[hydration]', error);
      },
    },
  );
}

void main();
