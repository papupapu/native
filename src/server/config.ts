import path from 'node:path';

export interface ServerConfig {
  env: 'development' | 'production';
  port: number;
  distDir: string;
}

/** Typed and validated once, at boot (portal18 reads nconf plus a remote config on every request). */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const port = Number(env['PORT'] ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${env['PORT']}`);
  }
  return {
    env: env['NODE_ENV'] === 'production' ? 'production' : 'development',
    port,
    distDir: path.resolve(import.meta.dirname, '../../dist'),
  };
}
