// Invitations and joining (US1; FR-001, FR-001b, FR-002; contracts/api.md).
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { invitation, member, notificationPreference } from '../db/schema/index.ts';
import { hashToken } from '../modules/invitations.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, PASSWORD, signIn } from '../test/setup.ts';

async function invite(inviter: { email: string; password: string } | string) {
  // Pass a token to reuse one sign-in (Better Auth limits sign-ins per visitor).
  const token = typeof inviter === 'string' ? inviter : await signIn(inviter);
  const result = await api('POST', '/api/v1/invitations', { token });
  expect(result.status).toBe(201);
  return { ...result.body, inviteToken: result.body.link.split('/join/')[1] as string, memberToken: token };
}

const signUp = (inviteToken: string, overrides: Record<string, unknown> = {}, ip?: string) =>
  api('POST', `/api/v1/invitations/${inviteToken}/accept`, {
    body: { email: 'alex@example.org', displayName: 'Alex', password: PASSWORD, ...overrides },
    ...(ip ? { ip } : {})
  });

/** The confirmation token from the most recent email to `to`. */
function confirmationToken(to: string) {
  const email = [...testOutbox].reverse().find((e) => e.to === to);
  const match = email?.text.match(/\/join\/confirm\/(\S+)/);
  if (!match?.[1]) throw new Error(`No confirmation email for ${to}`);
  return match[1];
}

const confirm = (token: string) => api('POST', '/api/v1/invitations/confirm', { body: { token } });

async function invitationRow(inviteToken: string) {
  const [row] = await db.select().from(invitation).where(eq(invitation.tokenHash, hashToken(inviteToken)));
  return row!;
}

describe('creating and checking invitations', () => {
  it('returns the link once, valid for 14 days, and shows the inviter', async () => {
    const founder = await createFounder('Sam');
    const created = await invite(founder);
    expect(created.link).toMatch(/\/join\/[A-Za-z0-9_-]{40,}$/);
    const days = (new Date(created.expiresAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13.9);
    expect(days).toBeLessThanOrEqual(14);

    const check = await api('GET', `/api/v1/invitations/${created.inviteToken}`);
    expect(check).toMatchObject({ status: 200, body: { valid: true, inviterName: 'Sam' } });

    // The raw token is never listed again.
    const mine = await api('GET', '/api/v1/me/invitations', { token: created.memberToken });
    expect(JSON.stringify(mine.body)).not.toContain(created.inviteToken);
    expect(mine.body.items[0].status).toBe('unused');
  });

  it('gives the same answer for used, expired, cancelled, and unknown links', async () => {
    const founder = await createFounder();
    const used = await invite(founder);
    await signUp(used.inviteToken);
    await confirm(confirmationToken('alex@example.org'));

    const expired = await invite(founder);
    await db.update(invitation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitation.id, expired.id));

    const cancelled = await invite(founder);
    expect((await api('POST', `/api/v1/invitations/${cancelled.id}/cancel`, { token: cancelled.memberToken })).status).toBe(204);

    const answers = [];
    for (const token of [used.inviteToken, expired.inviteToken, cancelled.inviteToken, 'unknown-token']) {
      answers.push(await api('GET', `/api/v1/invitations/${token}`));
    }
    for (const answer of answers) {
      expect(answer.status).toBe(404);
      expect(answer.body).toEqual(answers[0]!.body);
    }
    expect(answers[0]!.body.error.code).toBe('invitation_not_valid');
  });

  it('only lets the inviter cancel, and only while unused', async () => {
    const founder = await createFounder();
    const other = await createInvitedMember(founder, 'Robin');
    const created = await invite(founder);
    const otherToken = await signIn(other);
    expect((await api('POST', `/api/v1/invitations/${created.id}/cancel`, { token: otherToken })).status).toBe(404);
    expect((await api('POST', `/api/v1/invitations/${created.id}/cancel`, { token: created.memberToken })).status).toBe(204);
    expect((await api('POST', `/api/v1/invitations/${created.id}/cancel`, { token: created.memberToken })).status).toBe(404);
  });

  it('limits creation to 20 a day', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    for (let i = 0; i < 20; i += 1) expect((await api('POST', '/api/v1/invitations', { token })).status).toBe(201);
    const blocked = await api('POST', '/api/v1/invitations', { token });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('slow_down');
  });
});

describe('joining', () => {
  it('creates an unconfirmed member, holds the invitation, and emails a link', async () => {
    const founder = await createFounder('Sam');
    const { inviteToken } = await invite(founder);
    const accepted = await signUp(inviteToken, { emailNotifications: true });
    expect(accepted).toMatchObject({ status: 202, body: { status: 'check_your_email' } });

    const [alex] = await db.select().from(member).where(eq(member.email, 'alex@example.org'));
    expect(alex).toMatchObject({ emailVerified: false, invitedById: founder.id });
    const row = await invitationRow(inviteToken);
    expect(row.status).toBe('pending_confirmation');
    const holdDays = (row.reservedUntil!.getTime() - Date.now()) / 86_400_000;
    expect(holdDays).toBeGreaterThan(6.9);
    expect(holdDays).toBeLessThanOrEqual(7);

    expect(testOutbox.at(-1)).toMatchObject({ to: 'alex@example.org', subject: 'Please confirm your email to join wunan' });
    expect(testOutbox.at(-1)!.text).toContain('Sam invited you');

    // The join checkbox sets email notifications for every type.
    const preferences = await db.select().from(notificationPreference).where(eq(notificationPreference.memberId, alex!.id));
    expect(preferences).toHaveLength(5);
    expect(preferences.every((p) => p.email && !p.device)).toBe(true);
  });

  it('leaves email notifications off when the checkbox is not ticked', async () => {
    const founder = await createFounder();
    await signUp((await invite(founder)).inviteToken);
    const [alex] = await db.select().from(member).where(eq(member.email, 'alex@example.org'));
    const preferences = await db.select().from(notificationPreference).where(eq(notificationPreference.memberId, alex!.id));
    expect(preferences.every((p) => !p.email && !p.device)).toBe(true);
  });

  it('refuses sign-in until confirmed, then confirming signs in and uses the invitation', async () => {
    const founder = await createFounder();
    const { inviteToken } = await invite(founder);
    await signUp(inviteToken);
    const early = await api('POST', '/api/auth/sign-in/email', { body: { email: 'alex@example.org', password: PASSWORD } });
    expect(early.body.error.code).toBe('email_not_confirmed');

    const confirmed = await confirm(confirmationToken('alex@example.org'));
    expect(confirmed.status).toBe(200);
    const me = await api('GET', '/api/v1/me', { token: confirmed.body.token });
    expect(me.body.displayName).toBe('Alex');
    expect((await invitationRow(inviteToken)).status).toBe('used');
    expect(await signIn({ email: 'alex@example.org', password: PASSWORD })).toBeTruthy();

    // The confirmation link works only once.
    expect((await confirm(confirmationToken('alex@example.org'))).body.error.code).toBe('confirmation_not_valid');
  });

  it('refuses an email that already has an account', async () => {
    const founder = await createFounder();
    const result = await signUp((await invite(founder)).inviteToken, { email: founder.email });
    expect(result.status).toBe(409);
    expect(result.body.error.code).toBe('email_taken');
  });

  it('validates the sign-up details with plain messages', async () => {
    const founder = await createFounder();
    const result = await signUp((await invite(founder)).inviteToken, { email: 'not-an-email', displayName: '', password: 'short' });
    expect(result.status).toBe(400);
    expect(Object.keys(result.body.error.fields).sort()).toEqual(['displayName', 'email', 'password']);
    expect(result.body.error.fields.password).toBe('Please choose a password of at least 10 characters.');
  });

  it('deletes the unconfirmed account once the 7-day hold passes, so the same email can join', async () => {
    const founder = await createFounder();
    const { inviteToken } = await invite(founder);
    await signUp(inviteToken);
    await db.update(invitation).set({ reservedUntil: new Date(Date.now() - 1000) }).where(eq(invitation.tokenHash, hashToken(inviteToken)));

    // Any use of the link first releases expired holds.
    expect((await api('GET', `/api/v1/invitations/${inviteToken}`)).status).toBe(200);
    expect(await db.select().from(member).where(eq(member.email, 'alex@example.org'))).toHaveLength(0);
    expect((await invitationRow(inviteToken)).status).toBe('unused');

    expect((await signUp(inviteToken)).status).toBe(202);
  });

  it('still confirms within the hold even after the invitation itself expired', async () => {
    const founder = await createFounder();
    const { inviteToken } = await invite(founder);
    await signUp(inviteToken);
    await db.update(invitation).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(invitation.tokenHash, hashToken(inviteToken)));
    expect((await confirm(confirmationToken('alex@example.org'))).status).toBe(200);
  });

  it('lets someone start over on a held invitation, replacing the earlier account', async () => {
    const founder = await createFounder();
    const { inviteToken } = await invite(founder);
    await signUp(inviteToken, { email: 'alxe@example.org' }); // typo
    const typoToken = confirmationToken('alxe@example.org');
    expect((await signUp(inviteToken, { email: 'alex@example.org' })).status).toBe(202);

    expect(await db.select().from(member).where(eq(member.email, 'alxe@example.org'))).toHaveLength(0);
    expect((await confirm(typoToken)).status).toBe(404);
    expect((await confirm(confirmationToken('alex@example.org'))).status).toBe(200);
  });

  it('limits sign-up attempts per invitation and per visitor', async () => {
    const founder = await createFounder();
    const one = await invite(founder);
    const founderToken = one.memberToken;
    for (let i = 0; i < 5; i += 1) {
      expect((await signUp(one.inviteToken, { email: `a${i}@example.org` }, `198.51.100.${i + 1}`)).status).toBe(202);
    }
    expect((await signUp(one.inviteToken, { email: 'a9@example.org' }, '198.51.100.99')).status).toBe(429);

    // 10 per visitor per hour, across invitations.
    const links = [];
    for (let i = 0; i < 11; i += 1) links.push((await invite(founderToken)).inviteToken);
    for (let i = 0; i < 10; i += 1) {
      expect((await signUp(links[i]!, { email: `b${i}@example.org` }, '203.0.113.50')).status).toBe(202);
    }
    expect((await signUp(links[10]!, { email: 'b10@example.org' }, '203.0.113.50')).status).toBe(429);
    // Another visitor is not affected.
    expect((await signUp(links[10]!, { email: 'b10@example.org' }, '203.0.113.51')).status).toBe(202);
  });
});

describe('resending the confirmation email', () => {
  it('answers the same for unknown, confirmed, and waiting emails, and sends only for waiting', async () => {
    const founder = await createFounder();
    const { inviteToken } = await invite(founder);
    await signUp(inviteToken);
    const before = await invitationRow(inviteToken);
    testOutbox.length = 0;

    const answers = [];
    for (const email of ['nobody@example.org', founder.email, 'alex@example.org']) {
      answers.push(await api('POST', '/api/v1/invitations/resend-confirmation', { body: { email } }));
    }
    for (const answer of answers) expect(answer).toMatchObject({ status: 202, body: { status: 'sent_if_waiting' } });
    expect(testOutbox.map((e) => e.to)).toEqual(['alex@example.org']);

    // The hold is not extended, and the new link works.
    expect((await invitationRow(inviteToken)).reservedUntil).toEqual(before.reservedUntil);
    expect((await confirm(confirmationToken('alex@example.org'))).status).toBe(200);
  });
});
