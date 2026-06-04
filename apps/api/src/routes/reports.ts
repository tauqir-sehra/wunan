// Asking for help (contracts/api.md, "Agreements and problem reports").
import { createRoute, z } from '@hono/zod-openapi';
import { CreateReport, ProblemReport, ResolveReport } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as reports from '../modules/reports.ts';

export const reportRoutes = createRouter();
reportRoutes.use('/reports/*', requireMember);
reportRoutes.use('/agreements/:id/reports', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That request for help could not be found.' }) });
const reply = { content: { 'application/json': { schema: ProblemReport } } };

reportRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/agreements/{id}/reports',
    summary: "Ask for help with an agreement; opens a conversation with the other member's inviter",
    security,
    request: { params: z.object({ id: z.uuid() }), body: { content: { 'application/json': { schema: CreateReport } } } },
    responses: { 201: { description: 'The request for help', ...reply } }
  }),
  async (c) => c.json(await reports.createReport(c.req.valid('param').id, c.get('member').id, c.req.valid('json').description), 201)
);

reportRoutes.openapi(
  createRoute({ method: 'get', path: '/reports/{id}', summary: 'A request for help (reporter, reported member, helpers)', security, request: { params: Id }, responses: { 200: { description: 'The request for help', ...reply } } }),
  async (c) => c.json(await reports.getReport(c.req.valid('param').id, c.get('member').id), 200)
);

reportRoutes.openapi(
  createRoute({ method: 'post', path: '/reports/{id}/escalate', summary: 'Ask the next person up the invite chain (then the founders) to help', security, request: { params: Id }, responses: { 200: { description: 'The request for help', ...reply } } }),
  async (c) => c.json(await reports.escalate(c.req.valid('param').id, c.get('member').id), 200)
);

reportRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/reports/{id}/resolve',
    summary: 'Mark a request for help settled, with a note',
    security,
    request: { params: Id, body: { content: { 'application/json': { schema: ResolveReport } } } },
    responses: { 200: { description: 'The request for help', ...reply } }
  }),
  async (c) => c.json(await reports.resolve(c.req.valid('param').id, c.get('member').id, c.req.valid('json').outcomeNote), 200)
);
