// Endpoints about the signed-in member: profile, private contact details, password, notification
// settings and devices, data export, and leaving wunan (contracts/api.md, "Invitations and members").
import { createRoute, z } from '@hono/zod-openapi';
import {
  ChangePassword,
  ContactDetails,
  DeleteAccount,
  Me,
  NewPushSubscription,
  NotificationPreferences,
  PushDevice,
  PushDevices,
  Summary,
  UpdateMe
} from '@wunan/shared';
import { and, count, eq, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { listing, listingFlag } from '../db/schema/index.ts';
import { countNeedingAttention } from '../modules/agreements.ts';
import { countThreadsWithNews } from '../modules/messaging.ts';
import { createRouter } from '../app-router.ts';
import { requireMember } from '../lib/require-member.ts';
import { buildExport } from '../modules/export.ts';
import * as members from '../modules/members.ts';
import * as settings from '../modules/settings.ts';

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

meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/summary',
    summary: 'Quiet counts for the home page: unread conversations, agreements, new requests',
    security,
    responses: ok(Summary, 'Counts')
  }),
  async (c) => {
    const memberId = c.get('member').id;
    const [flags] = await db
      .select({ unseen: count() })
      .from(listingFlag)
      .innerJoin(listing, eq(listing.id, listingFlag.listingId))
      .where(and(eq(listing.ownerId, memberId), isNull(listingFlag.seenByOwnerAt)));
    return c.json(
      {
        proposalsWithNews: await countThreadsWithNews(memberId),
        agreementsNeedingAttention: await countNeedingAttention(memberId),
        unseenFlags: flags?.unseen ?? 0
      },
      200
    );
  }
);

meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/notification-preferences',
    summary: 'My notification settings: an email and a device switch for each of the five kinds',
    security,
    responses: ok(NotificationPreferences, 'Settings')
  }),
  async (c) => c.json(await settings.getPreferences(c.get('member').id), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'put',
    path: '/me/notification-preferences',
    summary: 'Save my notification settings (kinds left out keep their setting)',
    security,
    request: { body: body(NotificationPreferences) },
    responses: ok(NotificationPreferences, 'Saved')
  }),
  async (c) => c.json(await settings.savePreferences(c.get('member').id, c.req.valid('json')), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/push-subscriptions',
    summary: 'My devices that receive notifications, and the key a new device subscribes with',
    security,
    responses: ok(PushDevices, 'Devices')
  }),
  async (c) => c.json(await settings.listDevices(c.get('member').id), 200)
);

meRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/me/push-subscriptions',
    summary: 'Turn on notifications on this device',
    description:
      'Saves the device. If no kind of notification had devices turned on yet, turns devices on for all of them, ' +
      'so this is a single step; members can switch kinds off afterwards.',
    security,
    request: { body: body(NewPushSubscription) },
    responses: { 201: { description: 'Saved', content: { 'application/json': { schema: PushDevice } } } }
  }),
  async (c) => c.json(await settings.addDevice(c.get('member').id, c.req.valid('json')), 201)
);

const DeviceId = z.object({ id: z.uuid({ message: 'That device could not be found.' }) });

meRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/me/push-subscriptions/{id}',
    summary: 'Stop notifications on a device',
    security,
    request: { params: DeviceId },
    responses: { 204: { description: 'Removed' } }
  }),
  async (c) => {
    await settings.removeDevice(c.get('member').id, c.req.valid('param').id);
    return c.body(null, 204);
  }
);

meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/me/export',
    summary: 'Download all my data as a ZIP (contracts/export-format.md)',
    security,
    responses: {
      200: { description: 'ZIP file', content: { 'application/zip': { schema: z.string().openapi({ format: 'binary' }) } } }
    }
  }),
  async (c) => {
    const { zip, filename } = await buildExport(c.get('member').id);
    return c.body(zip, 200, {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store'
    });
  }
);

meRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/me',
    summary: 'Leave wunan: keeps only my display name; signs me out everywhere',
    security,
    request: { body: body(DeleteAccount) },
    responses: { 204: { description: 'Account deleted' } }
  }),
  async (c) => {
    await members.deleteAccount(c.get('member').id, c.req.valid('json').password);
    return c.body(null, 204);
  }
);
