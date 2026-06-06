// Offering endpoints (contracts/api.md, "Offerings"), including search (GET /offerings).
import { createRoute, z } from '@hono/zod-openapi';
import { CreateFlag, CreateOffering, Offering, MyOffering, SearchOfferingsQuery, UpdateOffering } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import { ApiError } from '../lib/errors.ts';
import * as offerings from '../modules/offerings.ts';
import * as requests from '../modules/requests.ts';
import { searchOfferings } from '../modules/search.ts';

export const offeringRoutes = createRouter();
offeringRoutes.use('/offerings', requireMember);
offeringRoutes.use('/offerings/*', requireMember);
offeringRoutes.use('/me/offerings', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That offering could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } }
});

offeringRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/offerings',
    summary: 'Search offerings (available ones, newest first; lent-out ones on request)',
    security,
    request: { query: SearchOfferingsQuery },
    responses: { 200: reply(z.object({ items: z.array(Offering), nextCursor: z.string().nullable() }), 'Matching offerings') }
  }),
  async (c) => c.json(await searchOfferings(c.req.valid('query'), c.get('member').id), 200)
);

offeringRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/offerings',
    summary: 'Create an offering (only type and title are required)',
    security,
    request: { body: body(CreateOffering) },
    responses: { 201: reply(Offering, 'The new offering') }
  }),
  async (c) => {
    const memberId = c.get('member').id;
    const input = c.req.valid('json');
    const created = await offerings.createOffering(memberId, input);
    if (!input.forRequest) return c.json(created, 201);
    // Made for a request (003 FR-012): link it. The offering is kept even if the link can't be made,
    // for example because the request was closed meanwhile; the answer says why.
    try {
      await requests.linkOffering(input.forRequest, created.id, memberId);
      return c.json({ ...(await offerings.getOffering(created.id, memberId)), linked: true }, 201);
    } catch (problem) {
      if (!(problem instanceof ApiError)) throw problem;
      return c.json({ ...created, linked: false, linkProblem: problem.code }, 201);
    }
  }
);

offeringRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/offerings/{id}',
    summary: 'An offering with photos, owner, and inviter (the owner also gets flags)',
    security,
    request: { params: Id },
    responses: { 200: reply(Offering, 'The offering') }
  }),
  async (c) => c.json(await offerings.getOffering(c.req.valid('param').id, c.get('member').id), 200)
);

offeringRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/offerings/{id}',
    summary: "Edit an offering (owner only; the type can't change)",
    security,
    request: { params: Id, body: body(UpdateOffering) },
    responses: { 200: reply(Offering, 'The updated offering') }
  }),
  async (c) => c.json(await offerings.updateOffering(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 200)
);

for (const change of ['pause', 'resume', 'remove', 'reopen'] as const) {
  offeringRoutes.openapi(
    createRoute({
      method: 'post',
      path: `/offerings/{id}/${change}`,
      summary: `${change[0]!.toUpperCase()}${change.slice(1)} an offering (owner only)`,
      security,
      request: { params: Id },
      responses: { 200: reply(Offering, 'The offering with its new status') }
    }),
    async (c) => c.json(await offerings.changeStatus(c.req.valid('param').id, c.get('member').id, change), 200)
  );
}

offeringRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/offerings/{id}/flags',
    summary: "Send the owner a written request about their offering (doesn't change it)",
    security,
    request: { params: Id, body: body(CreateFlag) },
    responses: { 204: { description: 'Sent to the owner' } }
  }),
  async (c) => {
    await offerings.flagOffering(c.req.valid('param').id, c.get('member').id, c.req.valid('json').request);
    return c.body(null, 204);
  }
);

offeringRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/offerings',
    summary: 'My offerings, with counts of requests I have not seen yet',
    security,
    responses: { 200: reply(z.object({ items: z.array(MyOffering) }), 'My offerings') }
  }),
  async (c) => c.json({ items: await offerings.listMine(c.get('member').id) }, 200)
);
