import serialize from 'serialize-javascript';
import { isRouteErrorResponse } from 'react-router';
import type { HydrationState, StaticHandlerContext } from 'react-router';

/** Safe to embed in an inline <script>: escapes `</script>`, U+2028/9 and HTML comments. */
export function serializeForScript(value: unknown): string {
  return serialize(value, { isJSON: true });
}

/**
 * Structural shape that `isRouteErrorResponse` recognises in the browser. With `hydrate={false}`
 * React Router does not serialize errors for us, and class instances would lose their prototype.
 */
function serializeError(error: unknown): unknown {
  if (isRouteErrorResponse(error)) {
    return { status: error.status, statusText: error.statusText, internal: false, data: error.data };
  }
  // Never leak message or stack of an unexpected error to the page.
  return { status: 500, statusText: 'Internal Server Error', internal: true, data: null };
}

export function toHydrationData(context: StaticHandlerContext): HydrationState {
  const errors = context.errors
    ? Object.fromEntries(Object.entries(context.errors).map(([routeId, error]) => [routeId, serializeError(error)]))
    : null;
  return { loaderData: context.loaderData, actionData: context.actionData, errors };
}
