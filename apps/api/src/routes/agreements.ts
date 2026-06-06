// Agreement endpoints (contracts/api.md, "Agreements and problem reports").
import { createRoute, z } from '@hono/zod-openapi';
import { Agreement } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as agreements from '../modules/agreements.ts';

export const agreementRoutes = createRouter();
agreementRoutes.use('/agreements/*', requireMember);
agreementRoutes.use('/me/agreements', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That agreement could not be found.' }) });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });

agreementRoutes.openapi(
  createRoute({ method: 'get', path: '/me/agreements', summary: 'My agreements: given, received, lent, borrowed, provided', security, responses: { 200: reply(z.object({ items: z.array(Agreement) }), 'My agreements') } }),
  async (c) => c.json({ items: await agreements.listMine(c.get('member').id) }, 200)
);

agreementRoutes.openapi(
  createRoute({ method: 'get', path: '/agreements/{id}', summary: 'One agreement (parties and mediators)', security, request: { params: Id }, responses: { 200: reply(Agreement, 'The agreement') } }),
  async (c) => c.json(await agreements.getAgreement(c.req.valid('param').id, c.get('member').id), 200)
);

agreementRoutes.openapi(
  createRoute({ method: 'post', path: '/agreements/{id}/returned', summary: 'Mark a loan returned (owner)', security, request: { params: Id }, responses: { 200: reply(Agreement, 'The agreement') } }),
  async (c) => c.json(await agreements.markReturned(c.req.valid('param').id, c.get('member').id), 200)
);
