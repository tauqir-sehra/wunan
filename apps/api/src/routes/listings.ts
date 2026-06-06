// Listing endpoints (contracts/api.md, "Listings"), including search (GET /listings).
import { createRoute, z } from '@hono/zod-openapi';
import { CreateFlag, CreateListing, Listing, MyListing, SearchListingsQuery, UpdateListing } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as listings from '../modules/listings.ts';
import { searchListings } from '../modules/search.ts';

export const listingRoutes = createRouter();
listingRoutes.use('/listings', requireMember);
listingRoutes.use('/listings/*', requireMember);
listingRoutes.use('/me/listings', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That listing could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } }
});

listingRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/listings',
    summary: 'Search listings (available ones, newest first; lent-out ones on request)',
    security,
    request: { query: SearchListingsQuery },
    responses: { 200: reply(z.object({ items: z.array(Listing), nextCursor: z.string().nullable() }), 'Matching listings') }
  }),
  async (c) => c.json(await searchListings(c.req.valid('query'), c.get('member').id), 200)
);

listingRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/listings',
    summary: 'Create a listing (only type and title are required)',
    security,
    request: { body: body(CreateListing) },
    responses: { 201: reply(Listing, 'The new listing') }
  }),
  async (c) => c.json(await listings.createListing(c.get('member').id, c.req.valid('json')), 201)
);

listingRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/listings/{id}',
    summary: 'A listing with photos, owner, and inviter (the owner also gets flags)',
    security,
    request: { params: Id },
    responses: { 200: reply(Listing, 'The listing') }
  }),
  async (c) => c.json(await listings.getListing(c.req.valid('param').id, c.get('member').id), 200)
);

listingRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/listings/{id}',
    summary: "Edit a listing (owner only; the type can't change)",
    security,
    request: { params: Id, body: body(UpdateListing) },
    responses: { 200: reply(Listing, 'The updated listing') }
  }),
  async (c) => c.json(await listings.updateListing(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 200)
);

for (const change of ['pause', 'resume', 'remove', 'reopen'] as const) {
  listingRoutes.openapi(
    createRoute({
      method: 'post',
      path: `/listings/{id}/${change}`,
      summary: `${change[0]!.toUpperCase()}${change.slice(1)} a listing (owner only)`,
      security,
      request: { params: Id },
      responses: { 200: reply(Listing, 'The listing with its new status') }
    }),
    async (c) => c.json(await listings.changeStatus(c.req.valid('param').id, c.get('member').id, change), 200)
  );
}

listingRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/listings/{id}/flags',
    summary: "Send the owner a written request about their listing (doesn't change it)",
    security,
    request: { params: Id, body: body(CreateFlag) },
    responses: { 204: { description: 'Sent to the owner' } }
  }),
  async (c) => {
    await listings.flagListing(c.req.valid('param').id, c.get('member').id, c.req.valid('json').request);
    return c.body(null, 204);
  }
);

listingRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/listings',
    summary: 'My listings, with counts of requests I have not seen yet',
    security,
    responses: { 200: reply(z.object({ items: z.array(MyListing) }), 'My listings') }
  }),
  async (c) => c.json({ items: await listings.listMine(c.get('member').id) }, 200)
);
