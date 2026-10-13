import type { ErrorRequestHandler } from 'express';

export function errorHandler(): ErrorRequestHandler {
  return (error, req, res, next) => {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
    // Mid-stream failure: the status line is gone, the only option left is to cut the connection.
    if (res.headersSent) {
      res.destroy();
      return next(error);
    }
    res.status(500).type('html').send('<!doctype html><title>500</title><h1>500 Errore interno</h1>');
  };
}
