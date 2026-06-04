// Invitation endpoints (contracts/api.md, "Invitations and members"). Thin: validate, call the
// module, return. The joining endpoints are public; the rest need a signed-in member.
import { createRoute, z } from '@hono/zod-openapi';
import {
  AcceptInvitation,
  ConfirmJoin,
  CreatedInvitation,
  InvitationCheck,
  MyInvitation,
  ResendConfirmation
} from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { clientAddress } from '../lib/rate-limit.ts';
import { requireMember } from '../lib/require-member.ts';
import * as invitations from '../modules/invitations.ts';

export const invitationRoutes = createRouter();

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  description,
  content: { 'application/json': { schema } }
});
const Token = z.object({ token: z.string().min(1) });
const Id = z.object({ id: z.uuid() });
const Accepted = z.object({ status: z.literal('check_your_email') });
const Resent = z.object({ status: z.literal('sent_if_waiting') });
const Confirmed = z.object({ token: z.string(), member: z.object({ id: z.string(), displayName: z.string() }) });

invitationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/invitations/{token}',
    summary: 'Check an invitation link (public)',
    request: { params: Token },
    responses: { 200: json(InvitationCheck, 'The link can be used') }
  }),
  async (c) => c.json(await invitations.checkInvitation(c.req.valid('param').token), 200)
);

invitationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/invitations/{token}/accept',
    summary: 'Sign up from an invitation (public); emails a confirmation link',
    request: { params: Token, body: { content: { 'application/json': { schema: AcceptInvitation } } } },
    responses: { 202: json(Accepted, 'Check your email') }
  }),
  async (c) => {
    const result = await invitations.startAcceptance(c.req.valid('param').token, c.req.valid('json'), clientAddress(c));
    return c.json(result, 202);
  }
);

invitationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/invitations/confirm',
    summary: 'Confirm the email from the emailed link (public); returns a session token',
    request: { body: { content: { 'application/json': { schema: ConfirmJoin } } } },
    responses: { 200: json(Confirmed, 'Joined and signed in') }
  }),
  async (c) => c.json(await invitations.confirmAcceptance(c.req.valid('json').token), 200)
);

invitationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/invitations/resend-confirmation',
    summary: 'Send the confirmation link again (public); always the same answer',
    request: { body: { content: { 'application/json': { schema: ResendConfirmation } } } },
    responses: { 202: json(Resent, 'Sent if that sign-up is waiting') }
  }),
  async (c) => c.json(await invitations.resendConfirmation(c.req.valid('json').email), 202)
);

invitationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/invitations',
    summary: 'Create an invitation; the link is returned only here',
    security: [{ bearer: [] }],
    middleware: [requireMember] as const,
    responses: { 201: json(CreatedInvitation, 'The new invitation') }
  }),
  async (c) => c.json(await invitations.createInvitation(c.get('member').id), 201)
);

invitationRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/invitations',
    summary: 'My invitations and their statuses',
    security: [{ bearer: [] }],
    middleware: [requireMember] as const,
    responses: { 200: json(z.object({ items: z.array(MyInvitation) }), 'My invitations') }
  }),
  async (c) => c.json({ items: await invitations.listMyInvitations(c.get('member').id) }, 200)
);

invitationRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/invitations/{id}/cancel',
    summary: 'Cancel an unused invitation (inviter only)',
    security: [{ bearer: [] }],
    middleware: [requireMember] as const,
    request: { params: Id },
    responses: { 204: { description: 'Cancelled' } }
  }),
  async (c) => {
    await invitations.cancelInvitation(c.get('member').id, c.req.valid('param').id);
    return c.body(null, 204);
  }
);
