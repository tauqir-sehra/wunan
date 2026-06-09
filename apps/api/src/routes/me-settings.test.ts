// Notification settings, devices, data export, and leaving wunan (FR-031, FR-031a, FR-032).
import { createECDH, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { strFromU8, unzipSync } from 'fflate';
import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import webpush from 'web-push';
import { app } from '../app.ts';
import { db } from '../db/index.ts';
import { invitation, offering, member, pushSubscription } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { notify } from '../notify/index.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, PASSWORD, propose, signIn } from '../test/setup.ts';

const types = ['message', 'agreement', 'reminder', 'report', 'flag', 'request', 'public_message'];

/** Keys like a browser's, so the push library can encrypt for them. */
function browserKeys() {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { p256dh: ecdh.getPublicKey('base64url'), auth: randomBytes(16).toString('base64url') };
}

afterEach(() => vi.restoreAllMocks());

const fcm = (name: string) => `https://fcm.googleapis.com/fcm/send/${name}-${randomBytes(6).toString('hex')}`;
const device = (endpoint: string, label = 'Phone') => ({ platform: 'web', endpoint, keys: browserKeys(), label });

describe('notification preferences', () => {
  it('start with both channels off and save per kind and channel', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    const initial = await api('GET', '/api/v1/me/notification-preferences', { token });
    expect(initial.body).toEqual(types.map((type) => ({ type, email: false, device: false })));

    const saved = await api('PUT', '/api/v1/me/notification-preferences', {
      token,
      body: [{ type: 'message', email: true, device: false }, { type: 'flag', email: false, device: true }]
    });
    expect(saved.status).toBe(200);
    expect(saved.body.find((p: { type: string }) => p.type === 'message')).toEqual({ type: 'message', email: true, device: false });
    expect(saved.body.find((p: { type: string }) => p.type === 'flag')).toEqual({ type: 'flag', email: false, device: true });
    expect(saved.body.find((p: { type: string }) => p.type === 'reminder')).toEqual({ type: 'reminder', email: false, device: false });

    const again = await api('PUT', '/api/v1/me/notification-preferences', { token, body: [{ type: 'message', email: false, device: false }] });
    expect(again.body.find((p: { type: string }) => p.type === 'message').email).toBe(false);
    expect(again.body.find((p: { type: string }) => p.type === 'flag').device).toBe(true);
  });

  it('are all on by email when the join checkbox was ticked', async () => {
    const founder = await createFounder();
    const founderToken = await signIn(founder);
    const { body: created } = await api('POST', '/api/v1/invitations', { token: founderToken });
    const token = created.link.split('/join/')[1];
    await api('POST', `/api/v1/invitations/${token}/accept`, {
      body: { email: 'kim@example.org', displayName: 'Kim', password: PASSWORD, emailNotifications: true }
    });
    const link = testOutbox.find((e) => e.to === 'kim@example.org')!.text.match(/\/join\/confirm\/(\S+)/)![1]!;
    expect((await api('POST', '/api/v1/invitations/confirm', { body: { token: link } })).status).toBe(200);
    const kimToken = await signIn({ email: 'kim@example.org', password: PASSWORD });
    const { body } = await api('GET', '/api/v1/me/notification-preferences', { token: kimToken });
    expect(body).toEqual(types.map((type) => ({ type, email: true, device: false })));
  });

  it('refuse unknown kinds and repeated kinds', async () => {
    const token = await signIn(await createFounder());
    expect((await api('PUT', '/api/v1/me/notification-preferences', { token, body: [{ type: 'marketing', email: true, device: false }] })).status).toBe(400);
    const twice = await api('PUT', '/api/v1/me/notification-preferences', {
      token,
      body: [{ type: 'message', email: true, device: false }, { type: 'message', email: false, device: false }]
    });
    expect(twice.status).toBe(400);
  });
});

describe('devices', () => {
  it('turning on a device is one step: it saves the device and switches device notifications on', async () => {
    const token = await signIn(await createFounder());
    const listed = await api('GET', '/api/v1/me/push-subscriptions', { token });
    expect(listed.body).toEqual({ publicKey: process.env.VAPID_PUBLIC_KEY, devices: [] });

    const added = await api('POST', '/api/v1/me/push-subscriptions', { token, body: device(fcm('laptop'), 'Firefox on my laptop') });
    expect(added.status).toBe(201);
    expect(added.body).toMatchObject({ label: 'Firefox on my laptop' });
    const prefs = await api('GET', '/api/v1/me/notification-preferences', { token });
    expect(prefs.body.every((p: { device: boolean }) => p.device)).toBe(true);

    // If the member had already chosen some kinds, a second device leaves that choice alone.
    await api('PUT', '/api/v1/me/notification-preferences', { token, body: types.map((type) => ({ type, email: false, device: type === 'message' })) });
    await api('POST', '/api/v1/me/push-subscriptions', { token, body: device(fcm('phone'), 'Phone') });
    const after = await api('GET', '/api/v1/me/notification-preferences', { token });
    expect(after.body.filter((p: { device: boolean }) => p.device).map((p: { type: string }) => p.type)).toEqual(['message']);
  });

  it('only accepts addresses on browser push services', async () => {
    const token = await signIn(await createFounder());
    for (const endpoint of ['https://example.org/push', 'http://fcm.googleapis.com/fcm/send/x', 'https://10.0.0.5/push', 'https://fcm.googleapis.com:8443/x']) {
      const result = await api('POST', '/api/v1/me/push-subscriptions', { token, body: device(endpoint) });
      expect(result.status, endpoint).toBe(400);
    }
    const real = await api('POST', '/api/v1/me/push-subscriptions', { token, body: device('https://fcm.googleapis.com/fcm/send/abc123') });
    expect(real.status).toBe(201);
  });

  it('can be removed only by the member who added them', async () => {
    const sam = await createFounder('Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const samToken = await signIn(sam);
    const alexToken = await signIn(alex);
    const { body } = await api('POST', '/api/v1/me/push-subscriptions', { token: samToken, body: device('https://fcm.googleapis.com/fcm/send/sam') });

    expect((await api('DELETE', `/api/v1/me/push-subscriptions/${body.id}`, { token: alexToken })).status).toBe(404);
    expect((await api('GET', '/api/v1/me/push-subscriptions', { token: alexToken })).body.devices).toEqual([]);
    expect((await api('DELETE', `/api/v1/me/push-subscriptions/${body.id}`, { token: samToken })).status).toBe(204);
    expect((await api('GET', '/api/v1/me/push-subscriptions', { token: samToken })).body.devices).toEqual([]);
  });

  it('a browser belongs to whoever turned it on last', async () => {
    const sam = await createFounder('Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const subscription = device('https://fcm.googleapis.com/fcm/send/shared-laptop');
    await api('POST', '/api/v1/me/push-subscriptions', { token: await signIn(sam), body: subscription });
    await api('POST', '/api/v1/me/push-subscriptions', { token: await signIn(alex), body: subscription });
    const rows = await db.select().from(pushSubscription);
    expect(rows.map((r) => r.memberId)).toEqual([alex.id]);
  });

  it('sends only a title, body and link, with the operator keys, and forgets gone devices', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    const endpoint = fcm('phone');
    await api('POST', '/api/v1/me/push-subscriptions', { token, body: device(endpoint) });
    const send = vi.spyOn(webpush, 'sendNotification').mockResolvedValue({ statusCode: 201, body: '', headers: {} });

    await notify(founder.id, 'flag', { title: 'Alex sent a request about your offering!', body: 'Hello', url: '/offerings/1' });
    expect(send).toHaveBeenCalledTimes(1);
    const [subscription, payload, options] = send.mock.calls[0]!;
    expect(subscription.endpoint).toBe(endpoint);
    expect(JSON.parse(payload as string)).toEqual({ title: 'Alex sent a request about your offering.', body: 'Hello', url: '/offerings/1' });
    expect(options?.vapidDetails?.publicKey).toBe(process.env.VAPID_PUBLIC_KEY);
    // The real library can encrypt for this device with these keys.
    expect(webpush.generateRequestDetails(subscription, payload as string, options).headers['Content-Encoding']).toBe('aes128gcm');

    send.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }));
    await notify(founder.id, 'flag', { title: 'Another request', body: 'Hi', url: '/offerings/1' });
    expect(await db.select().from(pushSubscription)).toEqual([]);
  });

  it('keeps a device when the push service only has a passing problem', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    await api('POST', '/api/v1/me/push-subscriptions', { token, body: device(fcm('phone')) });
    vi.spyOn(webpush, 'sendNotification').mockRejectedValue(Object.assign(new Error('Busy'), { statusCode: 503 }));
    await notify(founder.id, 'flag', { title: 'A request', body: 'Hi', url: '/offerings/1' });
    expect(await db.select().from(pushSubscription)).toHaveLength(1);
  });
});

async function download(token: string) {
  const response = await app.request('/api/v1/me/export', { headers: { authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.1' } });
  return { response, files: unzipSync(new Uint8Array(await response.arrayBuffer())) };
}

async function addPhoto(token: string, offeringId: string) {
  const bytes = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#7a9' } }).jpeg().toBuffer();
  const form = new FormData();
  form.set('file', new File([new Uint8Array(bytes)], 'photo', { type: 'image/jpeg' }));
  form.set('alt', 'Rice');
  await api('POST', `/api/v1/offerings/${offeringId}/photos`, { token, body: form });
}

describe('data export', () => {
  it("contains my data, a README, and my photos; others appear by display name only", async () => {
    const sam = await createFounder('Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const samToken = await signIn(sam);
    const alexToken = await signIn(alex);
    await api('PUT', '/api/v1/me/contact', { token: alexToken, body: { sharePhone: '07700 900999', shareEmail: 'alex.private@example.org' } });
    const { body: rice } = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'gift', title: 'Rice', amount: 5, unit: 'kg' } });
    await addPhoto(samToken, rice.id);
    await agree(samToken, alexToken, rice.id, completeDetails('gift', { amount: '2', message: 'Could I have 2 kg?' }));

    const { response, files } = await download(samToken);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="wunan-export-\d{4}-\d{2}-\d{2}\.zip"$/);
    expect(Object.keys(files).sort()).toEqual(['README.txt', 'my-wunan-data.json', `photos/${rice.id}-1.webp`]);
    expect(strFromU8(files['README.txt']!)).toContain('my-wunan-data.json');

    const json = strFromU8(files['my-wunan-data.json']!);
    const data = JSON.parse(json);
    expect(data.format_version).toBe(1);
    expect(data.profile).toMatchObject({ display_name: 'Sam', email: sam.email, is_founder: true, invited_by: null });
    expect(data.offerings[0]).toMatchObject({ title: 'Rice', amount: '5', remaining: '3', photos: [`photos/${rice.id}-1.webp`] });
    expect(data.agreements[0]).toMatchObject({ offering_title: 'Rice', role: 'owner', other_member: 'Alex', outcome: 'gifted', amount: '2' });
    expect(data.proposals[0]).toMatchObject({ with: 'Alex', offering_title: 'Rice', role: 'lister', status: 'accepted', amount: '2' });
    expect(data.proposals[0].messages[0]).toMatchObject({ from: 'Alex', body: 'Could I have 2 kg?' });
    expect(data.conversations).toEqual([]);
    expect(data.notification_preferences).toHaveLength(7);
    // Nothing private about Alex.
    expect(json).not.toContain(alex.email);
    expect(json).not.toContain('07700 900999');
    expect(json).not.toContain('alex.private@example.org');
    expect(json).not.toContain(alex.id);
  });

  it('needs a signed-in member, and is limited to 10 an hour', async () => {
    expect((await api('GET', '/api/v1/me/export')).status).toBe(401);
    const token = await signIn(await createFounder());
    for (let i = 0; i < 10; i += 1) expect((await download(token)).response.status).toBe(200);
    expect((await api('GET', '/api/v1/me/export', { token })).status).toBe(429);
  });
});

describe('leaving wunan', () => {
  async function scene() {
    const fay = await createFounder('Fay');
    const sam = await createInvitedMember(fay, 'Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const samToken = await signIn(sam);
    const alexToken = await signIn(alex);
    return { fay, sam, alex, samToken, alexToken };
  }

  it('needs the password', async () => {
    const { samToken } = await scene();
    const wrong = await api('DELETE', '/api/v1/me', { token: samToken, body: { password: 'not my password' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.password).toBe("That isn't your current password. Please try again.");
    expect((await api('DELETE', '/api/v1/me', { token: samToken, body: {} })).status).toBe(400);
    expect((await api('GET', '/api/v1/me', { token: samToken })).status).toBe(200);
  });

  it("can't be used to guess the password", async () => {
    const { samToken } = await scene();
    for (let i = 0; i < 10; i += 1) await api('DELETE', '/api/v1/me', { token: samToken, body: { password: `guess ${i}` } });
    const blocked = await api('DELETE', '/api/v1/me', { token: samToken, body: { password: PASSWORD } });
    expect(blocked.status).toBe(429);
    expect((await api('GET', '/api/v1/me', { token: samToken })).status).toBe(200);
  });

  it('keeps only the display name, removes offerings, photos and devices, and signs out everywhere', async () => {
    const { sam, alex, samToken, alexToken } = await scene();
    const otherDevice = await signIn(sam);
    await api('PATCH', '/api/v1/me', { token: samToken, body: { bio: 'I like bikes' } });
    await api('PUT', '/api/v1/me/contact', { token: samToken, body: { sharePhone: '07700 900123', shareEmail: 'sam.home@example.org' } });
    await api('POST', '/api/v1/me/push-subscriptions', { token: samToken, body: device('https://fcm.googleapis.com/fcm/send/sam') });
    await api('POST', '/api/v1/invitations', { token: samToken });

    const { body: pump } = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'gift', title: 'Bike pump', description: 'Pick up at 12 Elm Street' } });
    await addPhoto(samToken, pump.id);
    const { body: drill } = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'lend', title: 'Drill', area: 'Near the park' } });
    await addPhoto(samToken, drill.id);
    const deal = await agree(samToken, alexToken, drill.id, completeDetails('lend'));
    const started = { id: deal.conversationId };
    await api('POST', `/api/v1/conversations/${started.id}/messages`, { token: samToken, body: { contact: { phone: true } } });
    await api('POST', `/api/v1/conversations/${started.id}/messages`, { token: samToken, body: { body: 'See you Saturday' } });
    const loan = { id: deal.agreementId };
    // An open proposal on another of Sam's offerings closes when Sam leaves.
    const { body: ladder } = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'lend', title: 'Ladder' } });
    const open = await propose(alexToken, ladder.id);

    const deleted = await api('DELETE', '/api/v1/me', { token: samToken, body: { password: PASSWORD } });
    expect(deleted.status).toBe(204);

    // Signed out everywhere, and can't sign in again.
    expect((await api('GET', '/api/v1/me', { token: samToken })).status).toBe(401);
    expect((await api('GET', '/api/v1/me', { token: otherDevice })).status).toBe(401);
    expect((await api('POST', '/api/auth/sign-in/email', { body: { email: sam.email, password: PASSWORD } })).status).not.toBe(200);

    // Personal data is gone; the name stays, marked as no longer a member.
    const [row] = await db.select().from(member).where(eq(member.id, sam.id));
    expect(row).toMatchObject({ displayName: 'Sam', bio: null, sharePhone: null, shareEmail: null });
    expect(row!.email).not.toBe(sam.email);
    expect(row!.deletedAt).not.toBeNull();
    const profile = await api('GET', `/api/v1/members/${sam.id}`, { token: alexToken });
    expect(profile.body).toMatchObject({ displayName: 'Sam (no longer a member)', bio: null, isFormerMember: true });
    expect((await api('GET', `/api/v1/members/${alex.id}`, { token: alexToken })).body.invitedBy.displayName).toBe('Sam (no longer a member)');
    expect((await api('GET', `/api/v1/members/${alex.id}/chain`, { token: alexToken })).body.chain.map((c: { displayName: string }) => c.displayName))
      .toEqual(['Alex', 'Sam (no longer a member)', 'Fay']);

    // Offerings and photos are gone; the loaned drill keeps only its title for Alex's agreement.
    expect((await api('GET', `/api/v1/offerings/${pump.id}`, { token: alexToken })).status).toBe(404);
    const [kept] = await db.select().from(offering).where(eq(offering.id, drill.id));
    expect(kept).toMatchObject({ title: 'Drill', description: null, area: null, status: 'closed' });
    expect((await api('GET', `/api/v1/offerings/${drill.id}`, { token: alexToken })).body.photos).toEqual([]);
    expect((await api('GET', '/api/v1/offerings', { token: alexToken })).body.items).toEqual([]);

    // Alex still sees the agreement and the conversation, without Sam's phone number.
    const agreement = await api('GET', `/api/v1/agreements/${loan.id}`, { token: alexToken });
    expect(agreement.status).toBe(200);
    expect(agreement.body.owner.displayName).toBe('Sam (no longer a member)');
    const messages = await api('GET', `/api/v1/conversations/${started.id}/messages`, { token: alexToken });
    const bodies = messages.body.items.map((m: { body: string }) => m.body);
    expect(bodies).toContain('See you Saturday');
    expect(JSON.stringify(messages.body)).not.toContain('07700 900123');

    // Devices are gone, and unused invitation links stop working.
    expect(await db.select().from(pushSubscription)).toEqual([]);
    expect((await db.select().from(invitation).where(eq(invitation.inviterId, sam.id))).map((i) => i.status)).toEqual(['cancelled']);

    // The open proposal closed, and its offering stays (title only) so Alex's proposal still makes sense.
    expect((await api('GET', `/api/v1/proposals/${open.id}`, { token: alexToken })).body).toMatchObject({ status: 'closed', closedReason: 'member_left' });
    expect((await api('GET', `/api/v1/offerings/${ladder.id}`, { token: alexToken })).body).toMatchObject({ title: 'Ladder', status: 'closed' });
    // No more notifications.
    await notify(sam.id, 'message', { title: 'x', body: 'y', url: '/' });
  });

  it('frees the email, so it can be used to join again later', async () => {
    const { sam, samToken } = await scene();
    await api('DELETE', '/api/v1/me', { token: samToken, body: { password: PASSWORD } });
    expect(await db.select().from(member).where(eq(member.email, sam.email))).toEqual([]);
  });
});

describe('requests and public messages in export and deletion (003 US7)', () => {
  async function scene() {
    const fay = await createFounder('Fay');
    const sam = await createInvitedMember(fay, 'Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    return { samToken: await signIn(sam), alexToken: await signIn(alex) };
  }
  it('exports my requests, their links, my public messages, and flags about them', async () => {
    const { samToken, alexToken } = await scene();
    const id = (await api('POST', '/api/v1/requests', { token: samToken, body: { kind: 'trade', title: 'Bike pump', neededBy: '2099-01-01', giveBack: [{ description: 'Jam' }] } })).body.id;
    const { body: pump } = await api('POST', '/api/v1/offerings', { token: alexToken, body: { type: 'trade', title: 'Pump', forRequest: id } });
    await api('POST', `/api/v1/requests/${id}/messages`, { token: samToken, body: { body: 'Any size is fine' } });
    await api('POST', `/api/v1/requests/${id}/flags`, { token: alexToken, body: { request: 'Which valve?' } });
    const data = JSON.parse(strFromU8((await download(samToken)).files['my-wunan-data.json']!));
    expect(data.requests[0]).toMatchObject({
      kind: 'trade',
      title: 'Bike pump',
      needed_by: '2099-01-01',
      could_give_back: [{ description: 'Jam', amount: null, unit: null }],
      status: 'open',
      linked_offerings: [{ offering_id: pump.id, title: 'Pump' }]
    });
    expect(data.public_messages[0]).toMatchObject({ on: { request: id, title: 'Bike pump' }, body: 'Any size is fine', removed: false });
    expect(data.flags_received[0]).toMatchObject({ request_title: 'Bike pump', from: 'Alex', request: 'Which valve?' });
  });

  it('closes my requests for everyone and deletes my public messages when I leave', async () => {
    const { samToken, alexToken } = await scene();
    const id = (await api('POST', '/api/v1/requests', { token: samToken, body: { kind: 'borrow', title: 'Ladder', description: 'For the roof' } })).body.id;
    const { body: ladder } = await api('POST', '/api/v1/offerings', { token: alexToken, body: { type: 'lend', title: 'Ladder', forRequest: id } });
    await api('POST', `/api/v1/offerings/${ladder.id}/messages`, { token: samToken, body: { body: 'How tall is it?' } });
    expect((await api('DELETE', '/api/v1/me', { token: samToken, body: { password: PASSWORD } })).status).toBe(204);

    expect((await api('GET', `/api/v1/requests/${id}`, { token: alexToken })).status).toBe(404);
    expect((await api('GET', '/api/v1/requests', { token: alexToken })).body.items).toEqual([]);
    expect((await api('GET', `/api/v1/offerings/${ladder.id}/messages`, { token: alexToken })).body.items).toEqual([]);
    // Alex's offering stays as it was.
    expect((await api('GET', `/api/v1/offerings/${ladder.id}`, { token: alexToken })).body).toMatchObject({ status: 'available', answersRequest: null });
  });
});
