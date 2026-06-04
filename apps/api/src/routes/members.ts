// Member profiles and invite chains (FR-003, FR-004). Never includes email or contact details.
import { createRoute, z } from '@hono/zod-openapi';
import { MemberChain, MemberProfile } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as members from '../modules/members.ts';

export const memberRoutes = createRouter();
memberRoutes.use('/members/*', requireMember);

const Id = z.object({ id: z.uuid({ message: 'That member could not be found.' }) });

memberRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/members/{id}',
    summary: "A member's profile, inviter, and invitees",
    security: [{ bearer: [] }],
    request: { params: Id },
    responses: { 200: { description: 'Profile', content: { 'application/json': { schema: MemberProfile } } } }
  }),
  async (c) => c.json(await members.getProfile(c.req.valid('param').id), 200)
);

memberRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/members/{id}/chain',
    summary: 'The invite chain from this member up to a founding member',
    security: [{ bearer: [] }],
    request: { params: Id },
    responses: { 200: { description: 'Chain', content: { 'application/json': { schema: MemberChain } } } }
  }),
  async (c) => c.json(await members.getChain(c.req.valid('param').id), 200)
);
