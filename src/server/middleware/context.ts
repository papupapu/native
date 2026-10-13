import type { RequestHandler } from 'express';
import type { RequestCtx } from '../../shared/types.ts';

const BOT = /bot|crawler|spider|crawling|facebookexternalhit|slurp|lighthouse/i;
const LOCALES = ['it', 'en'];

function pickLocale(acceptLanguage: string | undefined): string {
  const preferred = acceptLanguage?.split(',')[0]?.trim().slice(0, 2).toLowerCase();
  return preferred && LOCALES.includes(preferred) ? preferred : 'it';
}

/** Equivalent of portal18's `contextMiddleware`: domain, locale and base URL, computed once per request. */
export function requestContext(): RequestHandler {
  return (req, res, next) => {
    const userAgent = req.get('user-agent') ?? '';
    const ctx: RequestCtx = {
      url: req.originalUrl,
      domain: req.hostname,
      locale: pickLocale(req.get('accept-language')),
      baseUrl: `${req.protocol}://${req.get('host') ?? req.hostname}`,
      userAgent,
      isBot: BOT.test(userAgent),
      cookies: (req.cookies ?? {}) as Record<string, string>,
    };
    res.locals['ctx'] = ctx;
    next();
  };
}
