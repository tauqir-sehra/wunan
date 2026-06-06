// Place suggestions while typing (002 contracts/api.md, "Places"). Members only; 60 a minute each.
import { createRoute } from '@hono/zod-openapi';
import { PlaceSuggestions, PlacesQuery } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { requireMember } from '../lib/require-member.ts';
import { searchPlaces, viewPlace } from '../modules/places.ts';

export const placeRoutes = createRouter();
placeRoutes.use('/places', requireMember);

placeRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/places',
    summary: 'Up to 8 place suggestions for what was typed; 503 when suggestions are off or not working',
    security: [{ bearer: [] }],
    request: { query: PlacesQuery },
    responses: { 200: { description: 'Suggestions', content: { 'application/json': { schema: PlaceSuggestions } } } }
  }),
  async (c) => {
    await checkRateLimit(`places:${c.get('member').id}`, 60, 1);
    const places = await searchPlaces(c.req.valid('query').q);
    return c.json({ items: places.map((place) => viewPlace(place, { full: true })!) }, 200);
  }
);
