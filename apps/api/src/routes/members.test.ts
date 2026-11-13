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

  it('has no separate invite chain page any more (005 FR-009)', async () => {
    const founder = await createFounder('Sam');
    const token = await signIn(founder);
    expect((await api('GET', `/api/v1/members/${founder.id}/chain`, { token })).status).toBe(404);
  });

  it('requires signing in', async () => {
    const founder = await createFounder();
    for (const path of [`/api/v1/members/${founder.id}`, '/api/v1/me']) {
      const result = await api('GET', path);
      expect(result.status, path).toBe(401);
      expect(result.body.error.code).toBe('not_signed_in');
    }
  });
});

describe('invite lines (005)', () => {
  const lineOf = async (id: string) =>
    (await db.select({ inviteLine: member.inviteLine }).from(member).where(eq(member.id, id)))[0]!
      .inviteLine;

  it('stores each member’s line from their founding member down to them', async () => {
    const fay = await createFounder('Fay');
    const ben = await createInvitedMember(fay, 'Ben');
    const you = await createInvitedMember(ben, 'You');
    expect(await lineOf(fay.id)).toEqual([fay.id]);
    expect(await lineOf(you.id)).toEqual([fay.id, ben.id, you.id]);
  });

  it('refuses a line that does not end with the member or skips their inviter', async () => {
    const fay = await createFounder('Fay');
    const ben = await createInvitedMember(fay, 'Ben');
    const you = await createInvitedMember(ben, 'You');
    await expect(
      db
        .update(member)
        .set({ inviteLine: [fay.id, ben.id] })
        .where(eq(member.id, you.id))
    ).rejects.toThrow();
    await expect(
      db
        .update(member)
        .set({ inviteLine: [fay.id, you.id] })
        .where(eq(member.id, you.id))
    ).rejects.toThrow();
    await expect(
      db
        .update(member)
        .set({ inviteLine: [ben.id, fay.id] })
        .where(eq(member.id, fay.id))
    ).rejects.toThrow();
  });
});

describe('how you are connected (005)', () => {
  const names = (people: { displayName: string }[]) => people.map((p) => p.displayName);

  /** Fay → Ben → You and Fay → Chloe → Faraz → Rosa, as in the spec's picture. */
  async function family() {
    const fay = await createFounder('Fay');
    const ben = await createInvitedMember(fay, 'Ben');
    const chloe = await createInvitedMember(fay, 'Chloe');
    const you = await createInvitedMember(ben, 'You');
    const faraz = await createInvitedMember(chloe, 'Faraz');
    const rosa = await createInvitedMember(faraz, 'Rosa');
    return { fay, ben, chloe, you, faraz, rosa, token: await signIn(you) };
  }

  it('shows two branches from the common ancestor, and nothing private', async () => {
    const { fay, rosa, token } = await family();
    await api('PUT', '/api/v1/me/contact', {
      token,
      body: { sharePhone: '07700 900123', shareEmail: 'you.private@example.org' }
    });
    const { body } = await api('GET', `/api/v1/members/${rosa.id}`, { token });
    expect(body.connection.kind).toBe('shared');
    expect(body.connection.top).toEqual({
      id: fay.id,
      displayName: 'Fay',
      isFounder: true,
      isFormerMember: false
    });
    expect(names(body.connection.toYou)).toEqual(['Ben', 'You']);
    expect(names(body.connection.toThem)).toEqual(['Chloe', 'Faraz', 'Rosa']);
    const text = JSON.stringify(body.connection);
    for (const secret of ['@', '07700', 'email', 'sharePhone']) expect(text).not.toContain(secret);
  });

  it('shows people who left, including the member being viewed', async () => {
    const { chloe, rosa, token } = await family();
    await db.update(member).set({ deletedAt: new Date() }).where(eq(member.id, chloe.id));
    await db.update(member).set({ deletedAt: new Date() }).where(eq(member.id, rosa.id));
    const { body } = await api('GET', `/api/v1/members/${rosa.id}`, { token });
    expect(body.connection.toThem).toMatchObject([
      { displayName: 'Chloe (no longer a member)', isFormerMember: true },
      { displayName: 'Faraz', isFormerMember: false },
      { displayName: 'Rosa (no longer a member)', isFormerMember: true }
    ]);
  });

  it('draws one line when one of you is in the other’s line', async () => {
    const { fay, ben, you, token } = await family();
    const sam = await createInvitedMember(you, 'Sam');
    const lee = await createInvitedMember(sam, 'Lee');

    const up = (await api('GET', `/api/v1/members/${fay.id}`, { token })).body.connection;
    expect(up).toMatchObject({ kind: 'theyAreAbove', top: { id: fay.id }, toThem: [] });
    expect(names(up.toYou)).toEqual(['Ben', 'You']);
    expect(
      (await api('GET', `/api/v1/members/${ben.id}`, { token })).body.connection.toYou
    ).toHaveLength(1);

    const down = (await api('GET', `/api/v1/members/${lee.id}`, { token })).body.connection;
    expect(down).toMatchObject({ kind: 'youAreAbove', top: { id: you.id }, toYou: [] });
    expect(names(down.toThem)).toEqual(['Sam', 'Lee']);
  });

  it('shows your own line on your own profile', async () => {
    const { fay, you, token } = await family();
    const mine = (await api('GET', `/api/v1/members/${you.id}`, { token })).body.connection;
    expect(mine).toMatchObject({ kind: 'self', top: { id: fay.id }, toThem: [] });
    expect(names(mine.toYou)).toEqual(['Ben', 'You']);
    const founder = (await api('GET', `/api/v1/members/${fay.id}`, { token: await signIn(fay) }))
      .body.connection;
    expect(founder).toMatchObject({ kind: 'self', top: { id: fay.id }, toYou: [], toThem: [] });
  });

  it('shows both lines in full when they go back to different founding members', async () => {
    const { token } = await family();
    const omar = await createFounder('Omar');
    const pia = await createInvitedMember(omar, 'Pia');
    const separate = (await api('GET', `/api/v1/members/${pia.id}`, { token })).body.connection;
    expect(separate).toMatchObject({ kind: 'separate', top: null });
    expect(names(separate.toYou)).toEqual(['Fay', 'Ben', 'You']);
    expect(names(separate.toThem)).toEqual(['Omar', 'Pia']);
  });

  it('answers quickly with two lines 20 deep (SC-003)', async () => {
    const root = await createFounder('Root');
    let left = root;
    let right = root;
    for (let i = 0; i < 20; i += 1) {
      left = await createInvitedMember(left, `L${i}`);
      right = await createInvitedMember(right, `R${i}`);
    }
    const token = await signIn(left);
    const started = performance.now();
    const { status, body } = await api('GET', `/api/v1/members/${right.id}`, { token });
    expect(status).toBe(200);
    expect(performance.now() - started).toBeLessThan(2000);
    expect(body.connection.toYou).toHaveLength(20);
    expect(body.connection.toThem).toHaveLength(20);
  }, 60_000);
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
