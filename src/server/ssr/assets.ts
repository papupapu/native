import fs from 'node:fs';
import path from 'node:path';
import type { AssetManifest } from '../../shared/manifest.ts';

export function readManifest(distDir: string): AssetManifest {
  return JSON.parse(fs.readFileSync(path.join(distDir, 'client', 'manifest.json'), 'utf8')) as AssetManifest;
}

/**
 * Critical CSS cache: the stylesheet of `main` and of every `route-*` group is read once at
 * boot (portal18 does a `readFileSync` per request). Production only.
 */
export function readCriticalCss(distDir: string, manifest: AssetManifest): Record<string, string> {
  const publicToDisk = (url: string) => path.join(distDir, 'client', url.replace(/^\/static\//, ''));
  const read = (urls: string[]) => urls.map((url) => fs.readFileSync(publicToDisk(url), 'utf8')).join('\n');

  const cache: Record<string, string> = { main: read(manifest.entry.css) };
  for (const [name, assets] of Object.entries(manifest.groups)) {
    if (name.startsWith('route-')) cache[name] = read(assets.css);
  }
  return cache;
}
