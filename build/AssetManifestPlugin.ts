import webpack from 'webpack';
import type { Compiler } from 'webpack';
import type { AssetManifest, Assets } from '../src/shared/manifest.ts';

interface Options {
  entry?: string;
  filename?: string;
  onManifest?: (manifest: AssetManifest) => void;
}

const NAME = 'AssetManifestPlugin';

export class AssetManifestPlugin {
  options: Options;

  constructor(options: Options = {}) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    const entryName = this.options.entry ?? 'main';
    const filename = this.options.filename ?? 'manifest.json';

    compiler.hooks.thisCompilation.tap(NAME, (compilation) => {
      compilation.hooks.processAssets.tap(
        { name: NAME, stage: webpack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => {
          const publicPath = String(compilation.outputOptions.publicPath ?? '/');
          const toAssets = (files: string[]): Assets => {
            const assets: Assets = { js: [], css: [] };
            for (const file of files) {
              if (file.includes('.hot-update.')) continue;
              const clean = file.split('?')[0] ?? file;
              if (clean.endsWith('.js')) assets.js.push(publicPath + file);
              else if (clean.endsWith('.css')) assets.css.push(publicPath + file);
            }
            return assets;
          };

          const entrypoint = compilation.entrypoints.get(entryName);
          if (!entrypoint) return;

          const groups: Record<string, Assets> = {};
          for (const [name, group] of compilation.namedChunkGroups) {
            if (compilation.entrypoints.has(name)) continue;
            groups[name] = toAssets(group.getFiles());
          }

          const manifest: AssetManifest = { entry: toAssets(entrypoint.getFiles()), groups };
          compilation.emitAsset(filename, new webpack.sources.RawSource(JSON.stringify(manifest, null, 2)));
          this.options.onManifest?.(manifest);
        },
      );
    });
  }
}
