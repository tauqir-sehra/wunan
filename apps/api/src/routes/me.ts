// Endpoints about the signed-in member: profile, private contact details, password
// (contracts/api.md, "Invitations and members").
import { createRoute, z } from '@hono/zod-openapi';
import { ChangePassword, ContactDetails, Me, UpdateMe } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import * as members from '../modules/members.ts';

export const meRoutes = createRouter();
meRoutes.use('/me', requireMember);
meRoutes.use('/me/*', requireMember);

const body = <T extends z.ZodType>(schema: T) => ({ content: { 'application/json': { schema } } });
const ok = <T extends z.ZodType>(schema: T, description: string) => ({
  200: { description, content: { 'application/json': { schema } } }
});
const security = [{ bearer: [] }];

meRoutes.openapi(
  createRoute({ method: 'get', path: '/me', summary: 'My profile', security, responses: ok(Me, 'My profile') }),
  async (c) => c.json(await members.getMe(c.get('member').id), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/me',
    summary: 'Change my display name or bio',
    security,
    request: { body: body(UpdateMe) },
    responses: ok(Me, 'My updated profile')
  }),
  async (c) => c.json(await members.updateMe(c.get('member').id, c.req.valid('json')), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/contact',
    summary: 'My private contact details (only ever shown to me)',
    security,
    responses: ok(ContactDetails, 'My contact details')
  }),
  async (c) => c.json(await members.getContact(c.get('member').id), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/me/contact',
    summary: 'Save my private contact details',
    security,
    request: { body: body(ContactDetails) },
    responses: ok(ContactDetails, 'Saved')
  }),
  async (c) => c.json(await members.updateContact(c.get('member').id, c.req.valid('json')), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/me/password',
    summary: 'Change my password (signs out my other devices)',
    security,
    request: { body: body(ChangePassword) },
    responses: { 204: { description: 'Changed' } }
  }),
  async (c) => {
    const { currentPassword, newPassword } = c.req.valid('json');
    await members.changePassword(c.get('member').id, c.get('sessionToken'), currentPassword, newPassword);
    return c.body(null, 204);
  }
);
