import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { RenderModule } from '../../shared/types.ts';

const require = createRequire(import.meta.url);

/**
 * Loads the webpack-built SSR bundle (`dist/server/render.cjs`, plain CommonJS on disk).
 * In dev the bundle is rewritten on every rebuild: when its mtime changes the require-cache
 * entry is dropped, so the next request runs the new code without restarting Express.
 */
export function createRendererLoader({ distDir, watch }: { distDir: string; watch: boolean }): () => RenderModule {
  const file = path.join(distDir, 'server', 'render.cjs');
  let cached: RenderModule | undefined;
  let loadedMtime = 0;

  return () => {
    const mtime = watch || !cached ? fs.statSync(file).mtimeMs : loadedMtime;
    if (!cached || mtime !== loadedMtime) {
      delete require.cache[file];
      const loaded = require(file) as { default?: RenderModule } & RenderModule;
      cached = loaded.default ?? loaded;
      loadedMtime = mtime;
    }
    return cached;
  };
}
