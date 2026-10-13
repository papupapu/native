import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import webpack from 'webpack';
import { createClientConfig } from './webpack.client.ts';
import { createServerConfig } from './webpack.server.ts';
import { dist } from './shared.ts';

const analyze = process.env['ANALYZE'] === '1';

const compiler = webpack([createClientConfig({ dev: false, analyze }), createServerConfig({ dev: false })]);

compiler.run((error, stats) => {
  compiler.close(() => {});
  if (error) {
    console.error(error);
    process.exit(1);
  }
  console.log(stats?.toString({ colors: true, assets: true, modules: false, children: false, chunks: false }));

  // Client stats for `check-bundle`: which modules sit in which chunk, and which chunks are initial.
  const client = stats?.stats[0];
  if (client) {
    mkdirSync(dist, { recursive: true });
    const json = client.toJson({
      all: false,
      chunks: true,
      chunkModules: true,
      nestedModules: true,
      chunkRelations: true,
      ids: true,
    });
    writeFileSync(path.join(dist, 'stats.json'), JSON.stringify(json));
  }
  process.exit(stats?.hasErrors() ? 1 : 0);
});
