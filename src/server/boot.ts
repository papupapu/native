import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { readCriticalCss, readManifest } from './ssr/assets.ts';
import { createRendererLoader } from './ssr/renderer.ts';

/** Production entry: config -> warm-up -> listen, with a graceful shutdown. */
async function boot() {
  const config = loadConfig();

  // Warm-up (stand-in for portal18's remote config / SearchManager init): everything the first
  // request needs is read here, so a missing build fails the boot instead of the first request.
  const manifest = readManifest(config.distDir);
  const criticalCss = readCriticalCss(config.distDir, manifest);
  const getRenderModule = createRendererLoader({ distDir: config.distDir, watch: false });
  getRenderModule();

  const app = createApp({
    distDir: config.distDir,
    getRenderModule,
    getManifest: () => manifest,
    getCriticalCss: () => criticalCss,
  });

  const server = app.listen(config.port, () => {
    console.log(`[portal] ${config.env} listening on http://localhost:${config.port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[portal] ${signal}: shutting down`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

boot().catch((error: unknown) => {
  console.error('[portal] boot failed', error);
  process.exit(1);
});
