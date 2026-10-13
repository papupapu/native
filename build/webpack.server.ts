import path from 'node:path';
import webpack from 'webpack';
import type { Configuration } from 'webpack';
import { dist, root, styleRule, swcRule } from './shared.ts';

export interface ServerOptions {
  dev: boolean;
}

/**
 * SSR render module: one CommonJS file (`dist/server/render.cjs`) with the app code and
 * all its npm dependencies bundled (only Node builtins stay external). Express loads it
 * with `createRequire`; in dev the file is rewritten on every change and the require
 * cache entry is dropped, so a plain CJS file on disk is what makes the reload reliable.
 */
export function createServerConfig({ dev }: ServerOptions): Configuration {
  return {
    name: 'server',
    mode: dev ? 'development' : 'production',
    target: 'node24',
    context: root,
    devtool: 'source-map',
    entry: { render: './src/ssr/render.tsx' },
    output: {
      path: path.join(dist, 'server'),
      filename: '[name].cjs',
      library: { type: 'commonjs2' },
      clean: !dev,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json'],
    },
    module: {
      rules: [swcRule({ target: 'node', dev, refresh: false }), styleRule({ target: 'node', dev })],
    },
    optimization: {
      splitChunks: false,
      runtimeChunk: false,
      minimize: false,
    },
    plugins: [
      new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
      new webpack.DefinePlugin({ __DEV__: JSON.stringify(dev) }),
    ],
    performance: { hints: false },
    stats: 'errors-warnings',
  };
}
