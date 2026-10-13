import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AssetManifest } from './manifest.ts';

/** Per-request data computed by the Express `requestContext` middleware. Server-only: never serialized as is. */
export interface RequestCtx {
  url: string;
  domain: string;
  locale: string;
  baseUrl: string;
  userAgent: string;
  isBot: boolean;
  cookies: Record<string, string>;
}

/** The only slice of `RequestCtx` that reaches the browser (whitelist: no cookies, no headers). */
export interface PublicConfig {
  domain: string;
  locale: string;
  baseUrl: string;
}

export function toPublicConfig(ctx: RequestCtx): PublicConfig {
  return { domain: ctx.domain, locale: ctx.locale, baseUrl: ctx.baseUrl };
}

export interface RenderOptions {
  manifest: AssetManifest;
  /** CSS inlined in <head>, keyed by chunk group name (`main`, `route-home`, ...). */
  criticalCss: Record<string, string>;
}

/** Contract between Express (runs under Node type stripping) and the webpack-built SSR bundle. */
export interface RenderModule {
  render(req: IncomingMessage, res: ServerResponse, ctx: RequestCtx, options: RenderOptions): Promise<void>;
}
