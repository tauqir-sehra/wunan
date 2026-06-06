// Proposal endpoints (002 contracts/api.md, "Proposals"). Thin: validate, call modules/proposals.ts.
import { createRoute, z } from '@hono/zod-openapi';
import { AcceptProposal, CreateProposal, Proposal, ProposalDecision, ProposalDetailsInput, ProposalsQuery, ProposalSummary } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as proposals from '../modules/proposals.ts';

export const proposalRoutes = createRouter();
proposalRoutes.use('/proposals', requireMember);
proposalRoutes.use('/proposals/*', requireMember);
proposalRoutes.use('/offerings/:id/proposals', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That proposal could not be found.' }) });
const OfferingId = z.object({ id: z.uuid({ message: 'That offering could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });

proposalRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/offerings/{id}/proposals',
    summary: 'Make a proposal on someone else\'s offering; every detail is optional',
    security,
    request: { params: OfferingId, body: body(CreateProposal) },
    responses: { 201: reply(z.object({ id: z.string(), conversationId: z.string() }), 'The new proposal') }
  }),
  async (c) => c.json(await proposals.createProposal(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 201)
);

proposalRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/proposals',
    summary: 'Proposals I made and received, open first',
    security,
    request: { query: ProposalsQuery },
    responses: { 200: reply(z.object({ items: z.array(ProposalSummary), nextCursor: z.string().nullable() }), 'My proposals') }
  }),
  async (c) => c.json(await proposals.listProposals(c.get('member').id, c.req.valid('query')), 200)
);

proposalRoutes.openapi(
  createRoute({ method: 'get', path: '/proposals/{id}', summary: 'One proposal: details, what still blocks it, and what I may do', security, request: { params: Id }, responses: { 200: reply(Proposal, 'The proposal') } }),
  async (c) => c.json(await proposals.getProposal(c.req.valid('param').id, c.get('member').id), 200)
);

proposalRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/proposals/{id}',
    summary: 'Change details (the requester only, while open); null clears a detail',
    security,
    request: { params: Id, body: body(ProposalDetailsInput) },
    responses: { 200: reply(Proposal, 'The proposal') }
  }),
  async (c) => c.json(await proposals.updateProposal(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 200)
);

proposalRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/proposals/{id}/accept',
    summary: 'Accept the details shown (the lister only); makes the agreement',
    security,
    request: { params: Id, body: body(AcceptProposal) },
    responses: { 200: reply(z.object({ agreementId: z.string() }), 'The agreement') }
  }),
  async (c) => c.json(await proposals.acceptProposal(c.req.valid('param').id, c.get('member').id, c.req.valid('json').version), 200)
);

proposalRoutes.openapi(
  createRoute({ method: 'post', path: '/proposals/{id}/decline', summary: 'Decline an open proposal (the lister only)', security, request: { params: Id, body: body(ProposalDecision) }, responses: { 200: reply(Proposal, 'The proposal') } }),
  async (c) => c.json(await proposals.declineProposal(c.req.valid('param').id, c.get('member').id, c.req.valid('json').note ?? null), 200)
);

proposalRoutes.openapi(
  createRoute({ method: 'post', path: '/proposals/{id}/withdraw', summary: 'Withdraw an open proposal (the requester only)', security, request: { params: Id, body: body(ProposalDecision) }, responses: { 200: reply(Proposal, 'The proposal') } }),
  async (c) => c.json(await proposals.withdrawProposal(c.req.valid('param').id, c.get('member').id, c.req.valid('json').note ?? null), 200)
);
