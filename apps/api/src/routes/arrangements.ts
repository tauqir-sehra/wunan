// Arrangement endpoints (004 contracts/api.md, "Arrangements"). Thin: validate, call
// modules/arrangements.ts. Asking for help with one is in routes/reports.ts.
import { createRoute, z } from '@hono/zod-openapi';
import { AcceptArrangement, Arrangement, ArrangementDecision, ArrangementDetailsInput, ArrangementList, ArrangementsQuery, CreateArrangement } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as arrangements from '../modules/arrangements.ts';

export const arrangementRoutes = createRouter();
arrangementRoutes.use('/arrangements', requireMember);
arrangementRoutes.use('/arrangements/*', requireMember);
arrangementRoutes.use('/offerings/:id/arrangements', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That arrangement could not be found.' }) });
const OfferingId = z.object({ id: z.uuid({ message: 'That offering could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });
const Asked = z.object({ id: z.string(), conversationId: z.string(), reopened: z.boolean() });

arrangementRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/offerings/{id}/arrangements',
    summary: "Ask for something on someone else's offering; every detail is optional. Asking again after it ended reopens the same arrangement",
    security,
    request: { params: OfferingId, body: body(CreateArrangement) },
    responses: { 201: reply(Asked, 'The new arrangement'), 200: reply(Asked, 'The earlier arrangement, reopened') }
  }),
  async (c) => {
    const asked = await arrangements.createArrangement(c.req.valid('param').id, c.get('member').id, c.req.valid('json'));
    return c.json(asked, asked.reopened ? 200 : 201);
  }
);

arrangementRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/arrangements',
    summary: 'My arrangements under "Waiting on you", "In progress" and "Finished" (20 at a time)',
    security,
    request: { query: ArrangementsQuery },
    responses: { 200: reply(ArrangementList, 'My arrangements') }
  }),
  async (c) => c.json(await arrangements.listArrangements(c.get('member').id, c.req.valid('query')), 200)
);

arrangementRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/arrangements/{id}',
    summary: 'One arrangement: details, stage, timeline, what still blocks it, and what I may do',
    security,
    request: { params: Id },
    responses: { 200: reply(Arrangement, 'The arrangement') }
  }),
  async (c) => c.json(await arrangements.getArrangement(c.req.valid('param').id, c.get('member').id), 200)
);

arrangementRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/arrangements/{id}',
    summary: 'Change details (the requester only, while open); null clears a detail',
    security,
    request: { params: Id, body: body(ArrangementDetailsInput) },
    responses: { 200: reply(Arrangement, 'The arrangement') }
  }),
  async (c) => c.json(await arrangements.updateArrangement(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 200)
);

arrangementRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/arrangements/{id}/accept',
    summary: 'Accept the details shown (the lister only); from then on it is agreed and fixed',
    security,
    request: { params: Id, body: body(AcceptArrangement) },
    responses: { 200: reply(Arrangement, 'The arrangement, now agreed') }
  }),
  async (c) => c.json(await arrangements.acceptArrangement(c.req.valid('param').id, c.get('member').id, c.req.valid('json').version), 200)
);

arrangementRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/arrangements/{id}/decline',
    summary: 'Decline while open (the lister only)',
    security,
    request: { params: Id, body: body(ArrangementDecision) },
    responses: { 200: reply(Arrangement, 'The arrangement') }
  }),
  async (c) => c.json(await arrangements.declineArrangement(c.req.valid('param').id, c.get('member').id, c.req.valid('json').note ?? null), 200)
);

arrangementRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/arrangements/{id}/withdraw',
    summary: 'Withdraw while open (the requester only)',
    security,
    request: { params: Id, body: body(ArrangementDecision) },
    responses: { 200: reply(Arrangement, 'The arrangement') }
  }),
  async (c) => c.json(await arrangements.withdrawArrangement(c.req.valid('param').id, c.get('member').id, c.req.valid('json').note ?? null), 200)
);

arrangementRoutes.openapi(
  createRoute({ method: 'post', path: '/arrangements/{id}/returned', summary: 'Mark an agreed loan returned (the owner only)', security, request: { params: Id }, responses: { 200: reply(Arrangement, 'The arrangement') } }),
  async (c) => c.json(await arrangements.markReturned(c.req.valid('param').id, c.get('member').id), 200)
);

arrangementRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/arrangements/{id}/done',
    summary: 'Mark an agreed gift, trade or service as done (either member); nobody is notified',
    security,
    request: { params: Id },
    responses: { 200: reply(Arrangement, 'The arrangement') }
  }),
  async (c) => c.json(await arrangements.markDone(c.req.valid('param').id, c.get('member').id), 200)
);

arrangementRoutes.openapi(
  createRoute({ method: 'post', path: '/arrangements/{id}/not-done', summary: 'Take "done" back (either member)', security, request: { params: Id }, responses: { 200: reply(Arrangement, 'The arrangement') } }),
  async (c) => c.json(await arrangements.markNotDone(c.req.valid('param').id, c.get('member').id), 200)
);
