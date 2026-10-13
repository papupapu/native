import webpack from 'webpack';
import webpackDevMiddleware from 'webpack-dev-middleware';
import webpackHotMiddleware from 'webpack-hot-middleware';
import type { AssetManifest } from '../src/shared/manifest.ts';
import { createApp } from '../src/server/app.ts';
import { loadConfig } from '../src/server/config.ts';
import { createRendererLoader } from '../src/server/ssr/renderer.ts';
import { PUBLIC_PATH, createClientConfig } from './webpack.client.ts';
import { createServerConfig } from './webpack.server.ts';

/**
 * One dev process:
 *  - client compiler -> webpack-dev-middleware (in memory) + hot-middleware + React Refresh;
 *  - server compiler -> `watch()`, writes `dist/server/render.cjs` to disk; the renderer loader
 *    drops the require cache when the file's mtime changes (no Express restart for UI/SSR edits);
 *  - `src/server/**` and `build/**` edits restart this whole process: run it through
 *    `node --watch-path=src/server --watch-path=build build/dev.ts` (the `dev` npm script).
 */
const config = loadConfig({ ...process.env, NODE_ENV: 'development' });

let manifest: AssetManifest | undefined;
const clientCompiler = webpack(createClientConfig({ dev: true, onManifest: (value) => (manifest = value) }));
const serverCompiler = webpack(createServerConfig({ dev: true }));

const serverBuilt = new Promise<void>((resolve) => {
  let first = true;
  serverCompiler.watch({ ignored: /node_modules/ }, (error, stats) => {
    if (error) console.error('[dev] server build failed', error);
    else if (stats?.hasErrors()) console.error(stats.toString('errors-only'));
    else console.log('[dev] server bundle rebuilt');
    if (first && !error && !stats?.hasErrors()) {
      first = false;
      resolve();
    }
  });
});

const devMiddleware = webpackDevMiddleware(clientCompiler, {
  publicPath: PUBLIC_PATH,
  writeToDisk: false,
  stats: 'errors-warnings',
});
const hotMiddleware = webpackHotMiddleware(clientCompiler, { log: false });

await Promise.all([serverBuilt, new Promise<void>((resolve) => devMiddleware.waitUntilValid(() => resolve()))]);

const app = createApp({
  distDir: config.distDir,
  getRenderModule: createRendererLoader({ distDir: config.distDir, watch: true }),
  getManifest: () => {
    if (!manifest) throw new Error('client manifest not ready');
    return manifest;
  },
  // No inline critical CSS in dev: the <link> tags (served by the middleware) are enough.
  getCriticalCss: () => ({}),
  mountAssets(application) {
    application.use(devMiddleware);
    application.use(hotMiddleware);
  },
});

const server = app.listen(config.port, () => {
  console.log(`[dev] http://localhost:${config.port}`);
});

const shutdown = () => {
  server.close();
  devMiddleware.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
