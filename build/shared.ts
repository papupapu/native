import path from 'node:path';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import type { RuleSetRule } from 'webpack';

export const root = path.resolve(import.meta.dirname, '..');
export const dist = path.join(root, 'dist');

export type Target = 'web' | 'node';

export function swcRule({ target, dev, refresh }: { target: Target; dev: boolean; refresh: boolean }): RuleSetRule {
  return {
    test: /\.[cm]?[jt]sx?$/,
    exclude: /node_modules/,
    loader: 'swc-loader',
    options: {
      swcrc: false,
      sourceMaps: true,
      module: { type: 'es6' },
      jsc: {
        target: target === 'web' ? 'es2020' : 'es2023',
        parser: { syntax: 'typescript', tsx: true },
        transform: {
          react: { runtime: 'automatic', development: dev, refresh },
        },
      },
    },
  };
}

/**
 * SCSS + CSS Modules (`*.module.scss`). Design tokens are injected in every file through
 * `additionalData` (same trick as dev-tools' `sassData`). The server bundle only needs the
 * class-name maps, so it never emits CSS (`exportOnlyLocals`).
 */
export function styleRule({ target, dev }: { target: Target; dev: boolean }): RuleSetRule {
  const web = target === 'web';
  return {
    test: /\.s?css$/,
    use: [
      ...(web ? [MiniCssExtractPlugin.loader] : []),
      {
        loader: 'css-loader',
        options: {
          importLoaders: 1,
          modules: {
            auto: /\.module\.s?css$/,
            // css-loader 7 defaults to named exports only; the code uses `import styles from`.
            namedExport: false,
            exportLocalsConvention: 'as-is',
            localIdentName: dev ? '[local]--[hash:base64:5]' : '[hash:base64:8]',
            exportOnlyLocals: !web,
          },
        },
      },
      {
        loader: 'sass-loader',
        options: {
          additionalData: '@use "tokens" as *;\n',
          sassOptions: {
            loadPaths: [path.join(root, 'src/styles')],
            silenceDeprecations: ['import'],
          },
        },
      },
    ],
  };
}
