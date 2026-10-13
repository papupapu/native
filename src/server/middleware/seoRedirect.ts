import type { RequestHandler } from 'express';

/** Stub of portal18's `seoManagerMiddleware`: a table of permanent redirects, answered before rendering. */
const REDIRECTS = new Map<string, string>([['/vecchia-url', '/annunci/1']]);

export function seoRedirect(): RequestHandler {
  return (req, res, next) => {
    const target = REDIRECTS.get(req.path);
    if (!target) return next();
    res.redirect(301, target);
  };
}
