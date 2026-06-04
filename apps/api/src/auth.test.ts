// Sign-in and account security (FR-001a, FR-001b, research §6).
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from './db/index.ts';
import { member } from './db/schema/index.ts';
import { createAccount } from './modules/members.ts';
import { api, createFounder, PASSWORD, signIn } from './test/setup.ts';

describe('sign-in', () => {
  it('works with the right email and password and returns a bearer token', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    const session = await api('GET', '/api/auth/get-session', { token });
    expect(session.status).toBe(200);
    expect(session.body.user.email).toBe(founder.email);
  });

  it('gives the same error for a wrong email and a wrong password', async () => {
    const founder = await createFounder();
    const wrongPassword = await api('POST', '/api/auth/sign-in/email', {
      body: { email: founder.email, password: 'not the password' }
    });
    const wrongEmail = await api('POST', '/api/auth/sign-in/email', {
      body: { email: 'nobody@example.org', password: PASSWORD }
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPassword.body).toEqual(wrongEmail.body);
    expect(wrongPassword.body).toEqual({
      error: {
        code: 'invalid_sign_in',
        message: "That email and password don't match. Please check them and try again."
      }
    });
  });

  it('slows down repeated failed sign-ins from one visitor, but not from others', async () => {
    const founder = await createFounder();
    const attempt = (ip: string) =>
      api('POST', '/api/auth/sign-in/email', { body: { email: founder.email, password: 'wrong password' }, ip });
    let last = await attempt('198.51.100.7');
    for (let i = 0; i < 12 && last.status !== 429; i += 1) last = await attempt('198.51.100.7');
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('slow_down');
    // A different visitor is unaffected (limits are per visitor address).
    expect((await attempt('198.51.100.8')).status).toBe(401);
  });

  it('tells an unconfirmed member to confirm, but only with the right password', async () => {
    const founder = await createFounder();
    await createAccount({ email: 'new@example.org', displayName: 'New', password: PASSWORD, invitedById: founder.id });
    const right = await api('POST', '/api/auth/sign-in/email', { body: { email: 'new@example.org', password: PASSWORD } });
    expect(right.status).toBe(403);
    expect(right.body).toEqual({
      error: { code: 'email_not_confirmed', message: 'Please open the confirmation link we emailed you.' }
    });
    const wrong = await api('POST', '/api/auth/sign-in/email', { body: { email: 'new@example.org', password: 'wrong password' } });
    expect(wrong.status).toBe(401);
    expect(wrong.body.error.code).toBe('invalid_sign_in');
  });

  it("rejects a deleted member's existing token", async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    await db.update(member).set({ deletedAt: new Date() }).where(eq(member.id, founder.id));
    const result = await api('GET', '/api/v1/me', { token });
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe('not_signed_in');
  });
});

describe('invite-only accounts', () => {
  it('always refuses the public sign-up route', async () => {
    const result = await api('POST', '/api/auth/sign-up/email', {
      body: { email: 'someone@example.org', password: PASSWORD, name: 'Someone' }
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.body.error).toBeDefined();
    const [created] = await db.select().from(member).where(eq(member.email, 'someone@example.org'));
    expect(created).toBeUndefined();
  });

  it('does not offer Better Auth routes that would bypass wunan rules', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    for (const path of ['/api/auth/update-user', '/api/auth/change-email', '/api/auth/verify-email']) {
      const result = await api('POST', path, { token, body: { name: 'Changed' } });
      expect(result.status, path).toBeGreaterThanOrEqual(400);
    }
    const [row] = await db.select().from(member).where(eq(member.id, founder.id));
    expect(row?.displayName).toBe(founder.displayName);
  });
});

describe('password reset', () => {
  it('answers the same way for registered and unknown emails', async () => {
    const founder = await createFounder();
    const redirectTo = `${process.env.SITE_URL}/password-reset`;
    const known = await api('POST', '/api/auth/request-password-reset', { body: { email: founder.email, redirectTo } });
    const unknown = await api('POST', '/api/auth/request-password-reset', { body: { email: 'nobody@example.org', redirectTo } });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
  });
});

describe('error shape', () => {
  it('uses { error: { code, message } } for every auth error', async () => {
    const results = [
      await api('POST', '/api/auth/sign-in/email', { body: { email: 'x@example.org', password: 'nope nope nope' } }),
      await api('POST', '/api/auth/sign-up/email', { body: {} }),
      await api('POST', '/api/auth/reset-password', { body: { token: 'nope', newPassword: PASSWORD } })
    ];
    for (const result of results) {
      expect(typeof result.body.error.code).toBe('string');
      expect(typeof result.body.error.message).toBe('string');
    }
  });
});
