// Profiles, invite chains, and my own details (US1; FR-003, FR-004, FR-005).
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { member } from '../db/schema/index.ts';
import { api, createFounder, createInvitedMember, PASSWORD, signIn } from '../test/setup.ts';

describe('profiles', () => {
  it('shows the inviter and invitees, and never email or contact details', async () => {
    const founder = await createFounder('Sam');
    const alex = await createInvitedMember(founder, 'Alex');
    const robin = await createInvitedMember(alex, 'Robin');
    const token = await signIn(robin);
    await api('PUT', '/api/v1/me/contact', { token, body: { sharePhone: '07700 900123', shareEmail: 'robin.private@example.org' } });

    const profile = await api('GET', `/api/v1/members/${alex.id}`, { token });
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({
      displayName: 'Alex',
      isFounder: false,
      isFormerMember: false,
      invitedBy: { id: founder.id, displayName: 'Sam' },
      invitees: [{ id: robin.id, displayName: 'Robin' }]
    });
    const robinProfile = JSON.stringify((await api('GET', `/api/v1/members/${robin.id}`, { token })).body);
    for (const secret of [robin.email, '07700', 'robin.private']) expect(robinProfile).not.toContain(secret);
  });

  it('shows founders as founding members with no inviter', async () => {
    const founder = await createFounder('Sam');
    const token = await signIn(founder);
    const profile = await api('GET', `/api/v1/members/${founder.id}`, { token });
    expect(profile.body).toMatchObject({ isFounder: true, invitedBy: null });
  });

  it('keeps a deleted inviter visible by name', async () => {
    const founder = await createFounder('Sam');
    const alex = await createInvitedMember(founder, 'Alex');
    const robin = await createInvitedMember(alex, 'Robin');
    await db.update(member).set({ deletedAt: new Date() }).where(eq(member.id, alex.id));
    const token = await signIn(robin);
    const profile = await api('GET', `/api/v1/members/${robin.id}`, { token });
    expect(profile.body.invitedBy).toEqual({ id: alex.id, displayName: 'Alex (no longer a member)' });
  });

  it('follows the chain up to a founder', async () => {
    const founder = await createFounder('Sam');
    const alex = await createInvitedMember(founder, 'Alex');
    const robin = await createInvitedMember(alex, 'Robin');
    const token = await signIn(robin);
    const chain = await api('GET', `/api/v1/members/${robin.id}/chain`, { token });
    expect(chain.body.chain.map((link: { displayName: string }) => link.displayName)).toEqual(['Robin', 'Alex', 'Sam']);
    expect(chain.body.chain.at(-1).isFounder).toBe(true);
  });

  it('requires signing in', async () => {
    const founder = await createFounder();
    for (const path of [`/api/v1/members/${founder.id}`, `/api/v1/members/${founder.id}/chain`, '/api/v1/me']) {
      const result = await api('GET', path);
      expect(result.status, path).toBe(401);
      expect(result.body.error.code).toBe('not_signed_in');
    }
  });
});

describe('my details', () => {
  it('limits display name to 1–60 characters and bio to 500', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    const tooLong = await api('PATCH', '/api/v1/me', { token, body: { displayName: 'x'.repeat(61), bio: 'y'.repeat(501) } });
    expect(tooLong.status).toBe(400);
    expect(Object.keys(tooLong.body.error.fields).sort()).toEqual(['bio', 'displayName']);
    expect((await api('PATCH', '/api/v1/me', { token, body: { displayName: '  ' } })).status).toBe(400);

    const saved = await api('PATCH', '/api/v1/me', { token, body: { displayName: 'Sam R.', bio: 'Gardener.' } });
    expect(saved.body).toMatchObject({ displayName: 'Sam R.', bio: 'Gardener.' });
  });

  it('stores contact details encrypted and returns them only to me', async () => {
    const founder = await createFounder();
    const token = await signIn(founder);
    const saved = await api('PUT', '/api/v1/me/contact', { token, body: { sharePhone: '07700 900123', shareEmail: '' } });
    expect(saved.body).toEqual({ sharePhone: '07700 900123', shareEmail: null });
    const [row] = await db.select().from(member).where(eq(member.id, founder.id));
    expect(row!.sharePhone).toMatch(/^v1:/);
    expect(row!.sharePhone).not.toContain('07700');
  });

  it('changes the password only with the current one, and signs out other devices', async () => {
    const founder = await createFounder();
    const here = await signIn(founder, '198.51.100.1');
    const elsewhere = await signIn(founder, '198.51.100.2');
    const wrong = await api('POST', '/api/v1/me/password', { token: here, body: { currentPassword: 'nope nope nope', newPassword: 'a brand new password' } });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.fields.currentPassword).toBeDefined();

    const changed = await api('POST', '/api/v1/me/password', { token: here, body: { currentPassword: PASSWORD, newPassword: 'a brand new password' } });
    expect(changed.status).toBe(204);
    expect((await api('GET', '/api/v1/me', { token: here })).status).toBe(200);
    expect((await api('GET', '/api/v1/me', { token: elsewhere })).status).toBe(401);
    expect(await signIn({ email: founder.email, password: 'a brand new password' })).toBeTruthy();
  });
});
