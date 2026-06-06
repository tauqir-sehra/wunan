// Request endpoints (003 contracts/api.md, "Requests"): asking, editing, closing, browsing,
// suggestions while asking, linking offerings, and flags.
import { createRoute, z } from '@hono/zod-openapi';
import { CreateFlag, CreateRequest, LinkOffering, Offering, Request, RequestSearchQuery, RequestSummary, SuggestionsQuery, UpdateRequest } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as requests from '../modules/requests.ts';

export const requestRoutes = createRouter();
requestRoutes.use('/requests', requireMember);
requestRoutes.use('/requests/*', requireMember);

const security = [{ bearer: [] }];
const Id = z.object({ id: z.uuid({ message: 'That request could not be found.' }) });
const LinkId = Id.extend({ linkId: z.uuid({ message: 'That link could not be found.' }) });
const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const reply = <T extends z.ZodType>(schema: T, description: string) => ({ description, content: { 'application/json': { schema } } });

requestRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/requests',
    summary: "Open requests by other members, newest first; or my own with mine=true",
    security,
    request: { query: RequestSearchQuery },
    responses: { 200: reply(z.object({ items: z.array(RequestSummary), nextCursor: z.string().nullable() }), 'Matching requests') }
  }),
  async (c) => c.json(await requests.listRequests(c.req.valid('query'), c.get('member').id), 200)
);

requestRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/requests',
    summary: 'Ask for something (only kind and title are required)',
    security,
    request: { body: body(CreateRequest) },
    responses: { 201: reply(z.object({ id: z.string() }), 'The new request') }
  }),
  async (c) => c.json(await requests.createRequest(c.get('member').id, c.req.valid('json')), 201)
);

// Declared before /requests/{id}, so "suggestions" is never read as an id.
requestRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/requests/suggestions',
    summary: 'Up to 5 available offerings that might already answer a request being written',
    security,
    request: { query: SuggestionsQuery },
    responses: { 200: reply(z.object({ items: z.array(Offering) }), 'Offerings that might fit') }
  }),
  async (c) => c.json(await requests.suggestOfferings(c.req.valid('query'), c.get('member').id), 200)
);

requestRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/requests/{id}',
    summary: 'A request with its details and linked offerings (the asker also gets flags)',
    security,
    request: { params: Id },
    responses: { 200: reply(Request, 'The request') }
  }),
  async (c) => c.json(await requests.getRequest(c.req.valid('param').id, c.get('member').id), 200)
);

requestRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/requests/{id}',
    summary: "Edit a request (asker only, while open; the kind can't change)",
    security,
    request: { params: Id, body: body(UpdateRequest) },
    responses: { 200: reply(Request, 'The updated request') }
  }),
  async (c) => c.json(await requests.updateRequest(c.req.valid('param').id, c.get('member').id, c.req.valid('json')), 200)
);

for (const change of ['close', 'reopen'] as const) {
  requestRoutes.openapi(
    createRoute({
      method: 'post',
      path: `/requests/{id}/${change}`,
      summary: change === 'close' ? 'Close a request (asker only)' : 'Open a closed request again (asker only)',
      security,
      request: { params: Id },
      responses: { 200: reply(Request, 'The request') }
    }),
    async (c) => {
      const { id } = c.req.valid('param');
      const memberId = c.get('member').id;
      return c.json(change === 'close' ? await requests.closeRequest(id, memberId) : await requests.reopenRequest(id, memberId), 200);
    }
  );
}

requestRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/requests/{id}/links',
    summary: 'Link an offering to a request as possibly answering it (your own offering, or as the asker)',
    security,
    request: { params: Id, body: body(LinkOffering) },
    responses: { 201: reply(z.object({ id: z.string() }), 'The new link') }
  }),
  async (c) => c.json(await requests.linkOffering(c.req.valid('param').id, c.req.valid('json').offeringId, c.get('member').id), 201)
);

requestRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/requests/{id}/links/{linkId}',
    summary: "Remove a link (who linked it, or the offering's owner); the offering is unchanged",
    security,
    request: { params: LinkId },
    responses: { 204: { description: 'Removed' } }
  }),
  async (c) => {
    const { id, linkId } = c.req.valid('param');
    await requests.unlinkOffering(id, linkId, c.get('member').id);
    return c.body(null, 204);
  }
);

requestRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/requests/{id}/flags',
    summary: "Send the asker a written request about their request (doesn't change it)",
    security,
    request: { params: Id, body: body(CreateFlag) },
    responses: { 204: { description: 'Sent to the asker' } }
  }),
  async (c) => {
    await requests.flagRequest(c.req.valid('param').id, c.get('member').id, c.req.valid('json').request);
    return c.body(null, 204);
  }
);
