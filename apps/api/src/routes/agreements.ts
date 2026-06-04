// Agreement endpoints (contracts/api.md, "Agreements and problem reports").
import { createRoute, z } from '@hono/zod-openapi';
import { Agreement, AgreementCandidate, CreateAgreement } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as agreements from '../modules/agreements.ts';

export const agreementRoutes = createRouter();
agreementRoutes.use('/agreements/*', requireMember);
agreementRoutes.use('/me/agreements', requireMember);
agreementRoutes.use('/listings/:id/agreement-candidates', requireMember);
agreementRoutes.use('/listings/:id/agreements', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That agreement could not be found.' }) });
const ListingId = z.object({ id: z.uuid({ message: 'That listing could not be found.' }) });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });

agreementRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/listings/{id}/agreement-candidates',
    summary: 'Members who messaged about this listing (owner only)',
    security,
    request: { params: ListingId },
    responses: { 200: reply(z.object({ items: z.array(AgreementCandidate) }), 'Candidates') }
  }),
  async (c) => c.json({ items: await agreements.listCandidates(c.req.valid('param').id, c.get('member').id) }, 200)
);

agreementRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/listings/{id}/agreements',
    summary: 'Record an agreement (owner only); updates the listing',
    security,
    request: { params: ListingId, body: { content: { 'application/json': { schema: CreateAgreement } } } },
    responses: { 201: reply(Agreement, 'The agreement') }
  }),
  async (c) => c.json(await agreements.recordAgreement(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 201)
);

agreementRoutes.openapi(
  createRoute({ method: 'get', path: '/me/agreements', summary: 'My agreements: given, received, lent, borrowed, provided', security, responses: { 200: reply(z.object({ items: z.array(Agreement) }), 'My agreements') } }),
  async (c) => c.json({ items: await agreements.listMine(c.get('member').id) }, 200)
);

agreementRoutes.openapi(
  createRoute({ method: 'get', path: '/agreements/{id}', summary: 'One agreement (parties and mediators)', security, request: { params: Id }, responses: { 200: reply(Agreement, 'The agreement') } }),
  async (c) => c.json(await agreements.getAgreement(c.req.valid('param').id, c.get('member').id), 200)
);

const actions = {
  confirm: { summary: 'Confirm the agreement (the other member)', run: (id: string, memberId: string) => agreements.confirmAgreement(id, memberId, 'confirmed') },
  dispute: { summary: 'Say the agreement needs a correction (the other member)', run: (id: string, memberId: string) => agreements.confirmAgreement(id, memberId, 'disputed') },
  returned: { summary: 'Mark a loan returned (owner)', run: agreements.markReturned },
  cancel: { summary: 'Cancel a pending agreement, undoing its effects (owner)', run: agreements.cancelAgreement }
} as const;

for (const [action, { summary, run }] of Object.entries(actions)) {
  agreementRoutes.openapi(
    createRoute({ method: 'post', path: `/agreements/{id}/${action}`, summary, security, request: { params: Id }, responses: { 200: reply(Agreement, 'The agreement') } }),
    async (c) => c.json(await run(c.req.valid('param').id, c.get('member').id), 200)
  );
}
