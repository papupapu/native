/**
 * What a slice stores when its thunk is rejected. A fixed text on purpose: slice state is
 * serialized into the page, and `action.error.message` can carry backend or internal details.
 * The real error is logged on the server (`src/ssr/render.tsx`, first load) and in the browser console
 * (`onError` of the `RouterProvider` in `src/client/entry.tsx`, client navigations).
 */
export const REQUEST_FAILED = 'request_failed';
