import path from 'node:path';
import webpack from 'webpack';
import type { Configuration } from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import ReactRefreshPlugin from '@pmmmwh/react-refresh-webpack-plugin';
import bundleAnalyzer from 'webpack-bundle-analyzer';
import { AssetManifestPlugin } from './AssetManifestPlugin.ts';
import type { AssetManifest } from '../src/shared/manifest.ts';
import { dist, root, styleRule, swcRule } from './shared.ts';

export interface ClientOptions {
  dev: boolean;
  analyze?: boolean;
  onManifest?: (manifest: AssetManifest) => void;
}

export const PUBLIC_PATH = '/static/';

export function createClientConfig({ dev, analyze = false, onManifest }: ClientOptions): Configuration {
  const hash = dev ? '' : '.[contenthash:8]';
  return {
    name: 'client',
    mode: dev ? 'development' : 'production',
    target: 'web',
    context: root,
    devtool: dev ? 'cheap-module-source-map' : 'source-map',
    entry: {
      main: [
        ...(dev ? ['webpack-hot-middleware/client?name=client&reload=true&overlay=false'] : []),
        './src/client/entry.tsx',
      ],
    },
    output: {
      path: path.join(dist, 'client'),
      publicPath: PUBLIC_PATH,
      filename: `[name]${hash}.js`,
      chunkFilename: `[name]${hash}.js`,
      clean: !dev,
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js', '.json'],
    },
    module: {
      rules: [swcRule({ target: 'web', dev, refresh: dev }), styleRule({ target: 'web', dev })],
    },
    optimization: {
      // Only an initial `vendor` chunk. No `common` cacheGroup with `chunks: 'all'`
      // (portal18 has one): it drags lazy code back into the initial bundle.
      splitChunks: {
        chunks: 'initial',
        cacheGroups: {
          default: false,
          defaultVendors: false,
          vendor: { test: /[\\/]node_modules[\\/]/, name: 'vendor', chunks: 'initial', enforce: true },
        },
      },
      runtimeChunk: false,
    },
    plugins: [
      new webpack.DefinePlugin({ __DEV__: JSON.stringify(dev) }),
      new MiniCssExtractPlugin({ filename: `[name]${hash}.css`, chunkFilename: `[name]${hash}.css` }),
      new AssetManifestPlugin({ onManifest }),
      ...(dev ? [new webpack.HotModuleReplacementPlugin(), new ReactRefreshPlugin({ overlay: false })] : []),
      ...(analyze
        ? [
            new bundleAnalyzer.BundleAnalyzerPlugin({
              analyzerMode: 'static',
              openAnalyzer: false,
              reportFilename: path.join(dist, 'bundle-report.html'),
            }),
          ]
        : []),
    ],
    performance: { hints: false },
    stats: 'errors-warnings',
  };
}
