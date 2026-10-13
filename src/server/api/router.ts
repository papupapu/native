import { Router } from 'express';
import { createInProcessServices } from '../../services/inProcess.ts';

/** `/api/v1`: what the browser services call on client navigations. SSR does not use it (in-process services). */
export function apiRouter(): Router {
  const services = createInProcessServices();
  const router = Router();

  router.get('/home', async (_req, res) => {
    res.json(await services.home.fetch());
  });

  router.get('/search', async (req, res) => {
    const q = req.query['q'];
    res.json(await services.search.fetch(typeof q === 'string' ? q : ''));
  });

  router.get('/listings/:id', async (req, res) => {
    const listing = await services.listing.fetch(req.params['id'] ?? '');
    if (!listing) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(listing);
  });

  router.get('/swpeople/:id', async (req, res) => {
    const character = await services.swpeople.fetch(req.params['id'] ?? '');
    if (!character) {
      res.status(404).json({ error: 'not found' });
      return;
    }
    res.json(character);
  });

  return router;
}
