import fs from 'node:fs';
import path from 'node:path';
import type { AssetManifest } from '../../shared/manifest.ts';
import type { InlineCss } from '../../shared/types.ts';

/** Inlined CSS above this size (main + one route) delays the first flush: move CSS to a lazy chunk. */
export const CRITICAL_CSS_BUDGET = 14 * 1024;

export function readManifest(distDir: string): AssetManifest {
  return JSON.parse(fs.readFileSync(path.join(distDir, 'client', 'manifest.json'), 'utf8')) as AssetManifest;
}

/**
 * Critical CSS cache: the stylesheets of `main` and of every `route-*` group are read once at
 * boot (portal18 does a `readFileSync` per request). Production only. Each file keeps its
 * public URL: `Document` inlines it as `<style data-href>` instead of linking it.
 * Warns when `main` + a route exceed `CRITICAL_CSS_BUDGET`.
 */
export function readCriticalCss(distDir: string, manifest: AssetManifest): Record<string, InlineCss[]> {
  const publicToDisk = (url: string) => path.join(distDir, 'client', url.replace(/^\/static\//, ''));
  const read = (urls: string[]): InlineCss[] =>
    urls.map((href) => ({ href, rules: fs.readFileSync(publicToDisk(href), 'utf8') }));
  const size = (files: InlineCss[]) => files.reduce((total, file) => total + Buffer.byteLength(file.rules), 0);

  const cache: Record<string, InlineCss[]> = { main: read(manifest.entry.css) };
  for (const [name, assets] of Object.entries(manifest.groups)) {
    if (!name.startsWith('route-')) continue;
    cache[name] = read(assets.css);
    const total = size(cache['main'] ?? []) + size(cache[name]);
    if (total > CRITICAL_CSS_BUDGET) {
      console.warn(`[portal] critical CSS of "${name}" is ${total} bytes (budget ${CRITICAL_CSS_BUDGET}): consider a lazy chunk`);
    }
  }
  return cache;
}
