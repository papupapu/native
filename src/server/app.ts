import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import type { Express } from 'express';
import type { AssetManifest } from '../shared/manifest.ts';
import type { InlineCss, RenderModule, RequestCtx } from '../shared/types.ts';
import { apiRouter } from './api/router.ts';
import { requestContext } from './middleware/context.ts';
import { errorHandler } from './middleware/errors.ts';
import { securityHeaders } from './middleware/headers.ts';
import { seoRedirect } from './middleware/seoRedirect.ts';

export interface AppDeps {
  distDir: string;
  getRenderModule(): RenderModule;
  getManifest(): AssetManifest;
  getCriticalCss(): Record<string, InlineCss[]>;
  /** Dev only: mounts webpack-dev-middleware / hot-middleware instead of serving `dist/client`. */
  mountAssets?(app: Express): void;
}

/** Mount order mirrors portal18 (`main.js` + `frontend/index.js`). */
export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.get('/status', (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/favicon.ico', (_req, res) => {
    res.status(204).end();
  });
  // Chrome DevTools probes `/.well-known/appspecific/com.chrome.devtools.json`: answer a plain 404
  // instead of rendering the whole app for a request that is not a page. Real well-known files
  // (assetlinks.json, security.txt, …) must be mounted above this.
  app.use('/.well-known/appspecific', (_req, res) => {
    res.status(404).end();
  });
  app.use('/api/v1', apiRouter());

  if (deps.mountAssets) {
    deps.mountAssets(app);
  } else {
    app.use(
      '/static',
      express.static(path.join(deps.distDir, 'client'), { immutable: true, maxAge: '1y', index: false }),
    );
  }

  app.use(cookieParser());
  app.use(securityHeaders());
  app.use(requestContext());
  app.use(seoRedirect());
  // HTML only: it sits after `/api/v1` and the static assets, which stay uncompressed (a CDN or the
  // reverse proxy usually does that). No page uses Suspense today, so the shell is the whole document.
  // `compression` also adds `res.flush()`, which React calls after each chunk it writes: if a Suspense
  // boundary is ever added, the gzip buffer will not hold its content back.
  app.use(compression());

  // Express 5: async handlers that reject are forwarded to the error handler.
  app.get('/{*splat}', async (req, res) => {
    await deps.getRenderModule().render(req, res, res.locals['ctx'] as RequestCtx, {
      manifest: deps.getManifest(),
      criticalCss: deps.getCriticalCss(),
    });
  });

  app.use(errorHandler());
  return app;
}
