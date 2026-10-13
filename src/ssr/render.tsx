import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderToPipeableStream } from 'react-dom/server';
import { Provider } from 'react-redux';
import {
  createStaticHandler,
  createStaticRouter,
  isRouteErrorResponse,
  RouterContextProvider,
  StaticRouterProvider,
} from 'react-router';
import { routes } from '../app/routes.ts';
import type { RouteHandle } from '../app/types.ts';
import { createInProcessServices } from '../services/inProcess.ts';
import type { AssetManifest } from '../shared/manifest.ts';
import { toPublicConfig } from '../shared/types.ts';
import type { RenderModule, RenderOptions, RequestCtx } from '../shared/types.ts';
import { makeStore } from '../store/makeStore.ts';
import { storeContext } from '../store/storeContext.ts';
import { Document } from './Document.tsx';
import { serializeForScript, toHydrationData } from './serialize.ts';

const ABORT_AFTER_MS = 10_000;

// Built once: route objects (and the `lazy` parts RR resolves into them) are shared by all requests.
const handler = createStaticHandler(routes);

function toRequest(req: IncomingMessage, ctx: RequestCtx, signal: AbortSignal): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  return new Request(ctx.baseUrl + ctx.url, { method: req.method ?? 'GET', headers, signal });
}

function pickAssets(manifest: AssetManifest, chunk: string | undefined) {
  const group = chunk ? manifest.groups[chunk] : undefined;
  return {
    js: [...manifest.entry.js, ...(group?.js ?? [])],
    css: [...manifest.entry.css, ...(group?.css ?? [])],
  };
}

async function render(req: IncomingMessage, res: ServerResponse, ctx: RequestCtx, options: RenderOptions) {
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  const store = makeStore({ preloadedState: { config: toPublicConfig(ctx) }, services: createInProcessServices() });
  const requestContext = new RouterContextProvider();
  requestContext.set(storeContext, store);

  const result = await handler.query(toRequest(req, ctx, controller.signal), { requestContext });

  // A loader threw `redirect()`: send it as is.
  if (result instanceof Response) {
    const headers: Record<string, string> = {};
    result.headers.forEach((value, name) => (headers[name] = value));
    res.writeHead(result.status, headers);
    res.end();
    return;
  }

  // Unexpected loader errors (a rejected thunk, a thrown Error) become a generic 500 for the browser:
  // the real cause is only visible here. 404s and other thrown `data()` are expected, not logged.
  for (const [routeId, error] of Object.entries(result.errors ?? {})) {
    if (!isRouteErrorResponse(error)) console.error(`[ssr] loader error in "${routeId}"`, error);
  }

  const router = createStaticRouter(handler.dataRoutes, result);
  const leaf = result.matches[result.matches.length - 1];
  const chunk = (leaf?.route.handle as RouteHandle | undefined)?.chunk;
  const assets = pickAssets(options.manifest, chunk);
  const inlineCss = ['main', chunk]
    .map((name) => (name ? options.criticalCss[name] : undefined))
    .filter((css): css is string => Boolean(css));

  // Status is decided here, before the first byte is flushed.
  const status = result.statusCode;
  const sliceKeys = ['config', ...result.matches.flatMap((match) => (match.route.handle as RouteHandle | undefined)?.slices ?? [])];
  const publicState = Object.fromEntries(
    Object.entries(store.getState()).filter(([key]) => sliceKeys.includes(key)),
  );
  const bootstrapScriptContent =
    `window.__INITIAL_STATE__=${serializeForScript(publicState)};` +
    `window.__ROUTER_DATA__=${serializeForScript(toHydrationData(result))};`;

  await new Promise<void>((resolve, reject) => {
    const stream = renderToPipeableStream(
      <Document lang={ctx.locale} css={assets.css} inlineCss={inlineCss}>
        <Provider store={store}>
          <StaticRouterProvider router={router} context={result} hydrate={false} />
        </Provider>
      </Document>,
      {
        bootstrapScriptContent,
        bootstrapScripts: assets.js,
        // Browsers get the shell as soon as it is ready (Suspense content streams in later);
        // crawlers wait for everything so they see the complete document.
        onShellReady() {
          if (ctx.isBot) return;
          start();
        },
        onAllReady() {
          if (ctx.isBot) start();
        },
        onShellError(error) {
          clearTimeout(timer);
          reject(error);
        },
        onError(error) {
          console.error('[ssr]', error);
        },
      },
    );

    const timer = setTimeout(() => stream.abort(), ABORT_AFTER_MS);
    res.on('close', () => {
      clearTimeout(timer);
      resolve();
    });

    function start() {
      res.statusCode = status;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      stream.pipe(res);
    }
  });
}

const renderModule: RenderModule = { render };
export default renderModule;
