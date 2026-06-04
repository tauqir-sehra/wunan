// Listings (US2; FR-007 to FR-014, FR-013a, FR-013b; contracts/api.md "Listings").
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { listing, notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, signIn } from '../test/setup.ts';

async function owner() {
  const founder = await createFounder('Sam');
  return { founder, token: await signIn(founder) };
}

const create = (token: string, body: Record<string, unknown>) => api('POST', '/api/v1/listings', { token, body });

describe('creating listings', () => {
  it('needs only a type and a title', async () => {
    const { token } = await owner();
    const result = await create(token, { type: 'gift', title: 'Rice' });
    expect(result.status).toBe(201);
    expect(result.body).toMatchObject({ type: 'gift', title: 'Rice', status: 'available', amount: null, photos: [] });
    expect(result.body.owner).toMatchObject({ displayName: 'Sam', invitedBy: null });
  });

  it('stores each type with its own fields and starting amounts', async () => {
    const { token } = await owner();
    const gift = await create(token, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg', area: 'Riverside' });
    expect(gift.body).toMatchObject({ amount: '5', unit: 'kg', remaining: '5', area: 'Riverside' });
    const lend = await create(token, { type: 'lend', title: 'Drill', amount: 1, unit: 'item', loanLength: 3, loanLengthUnit: 'days' });
    expect(lend.body).toMatchObject({ loanLength: 3, loanLengthUnit: 'days', remaining: null });
    const trade = await create(token, { type: 'trade', title: 'Sneakers', amount: '1', unit: 'item', wanted: 'leather boots' });
    expect(trade.body).toMatchObject({ wanted: 'leather boots', openToOffers: false, remaining: '1' });
    const service = await create(token, { type: 'service', title: 'Bodywork session', sessionLength: 1, sessionLengthUnit: 'hours', sessionsAvailable: 3 });
    expect(service.body).toMatchObject({ sessionLength: 1, sessionsAvailable: 3, sessionsRemaining: 3 });
  });

  it("refuses fields that don't apply to the type", async () => {
    const { token } = await owner();
    const gift = await create(token, { type: 'gift', title: 'Rice', loanLength: 3, loanLengthUnit: 'days' });
    expect(gift.status).toBe(400);
    expect(gift.body.error.fields).toMatchObject({ loanLength: "This doesn't apply here.", loanLengthUnit: "This doesn't apply here." });
    expect((await create(token, { type: 'service', title: 'Haircut', amount: '1', unit: 'item' })).status).toBe(400);
  });

  it('needs a unit with an amount, and an amount above 0', async () => {
    const { token } = await owner();
    const noUnit = await create(token, { type: 'gift', title: 'Rice', amount: '5' });
    expect(noUnit.body.error.fields.unit).toBe('Please choose a unit for the amount.');
    const zero = await create(token, { type: 'gift', title: 'Rice', amount: '0', unit: 'kg' });
    expect(zero.body.error.fields.amount).toBe('Please enter a number above 0, like 2 or 2.5.');
  });

  it('needs Trade to say what is wanted or be open to offers', async () => {
    const { token } = await owner();
    const neither = await create(token, { type: 'trade', title: 'Sneakers' });
    expect(neither.status).toBe(400);
    expect(neither.body.error.fields.wanted).toBe("Say what you'd like in return, or tick Open to offers.");
    expect((await create(token, { type: 'trade', title: 'Sneakers', openToOffers: true })).status).toBe(201);
  });

  it('checks the title', async () => {
    const { token } = await owner();
    expect((await create(token, { type: 'gift', title: ' ' })).body.error.fields.title).toBe('Please add a title.');
    expect((await create(token, { type: 'gift', title: 'x'.repeat(101) })).status).toBe(400);
  });
});

describe('editing and status', () => {
  it("lets only the owner edit, and the type can't change", async () => {
    const { founder, token } = await owner();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const other = await signIn(await createInvitedMember(founder, 'Alex'));

    expect((await api('PATCH', `/api/v1/listings/${rice.id}`, { token: other, body: { title: 'Mine' } })).status).toBe(403);
    expect((await api('PATCH', `/api/v1/listings/${rice.id}`, { token, body: { type: 'lend' } })).status).toBe(400);

    const edited = await api('PATCH', `/api/v1/listings/${rice.id}`, { token, body: { title: 'Brown rice', amount: '6' } });
    expect(edited.body).toMatchObject({ title: 'Brown rice', amount: '6', remaining: '6', unit: 'kg' });
    // Edits are checked against the type's rules.
    expect((await api('PATCH', `/api/v1/listings/${rice.id}`, { token, body: { loanLength: 2 } })).status).toBe(400);
  });

  it('follows the status rules, and only the owner can change them', async () => {
    const { founder, token } = await owner();
    const { body: drill } = await create(token, { type: 'lend', title: 'Drill' });
    const other = await signIn(await createInvitedMember(founder, 'Alex'));
    const post = (change: string, t = token) => api('POST', `/api/v1/listings/${drill.id}/${change}`, { token: t });

    expect((await post('pause', other)).status).toBe(403);
    expect((await post('resume')).status).toBe(409); // Not paused.
    expect((await post('pause')).body.status).toBe('paused');
    expect((await post('resume')).body.status).toBe('available');
    expect((await post('remove')).body).toMatchObject({ status: 'closed', closedReason: 'removed' });
    expect((await post('remove')).status).toBe(409);
  });

  it('reopens a removed listing with its remaining amount unchanged', async () => {
    const { token } = await owner();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    await db.update(listing).set({ remaining: '3' }).where(eq(listing.id, rice.id));
    await api('POST', `/api/v1/listings/${rice.id}/remove`, { token });
    const reopened = await api('POST', `/api/v1/listings/${rice.id}/reopen`, { token });
    expect(reopened.body).toMatchObject({ status: 'available', closedReason: null, remaining: '3' });
  });

  it("won't reopen a listing that closed because nothing was left", async () => {
    const { token } = await owner();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    await db.update(listing).set({ remaining: '0', status: 'closed', closedReason: 'used_up' }).where(eq(listing.id, rice.id));
    const result = await api('POST', `/api/v1/listings/${rice.id}/reopen`, { token });
    expect(result.status).toBe(409);
    expect(result.body.error.message).toContain('create a new listing');
  });
});

describe('flags', () => {
  it("notify the owner, can't target your own listing, and leave the listing unchanged", async () => {
    const { founder, token } = await owner();
    await db.update(notificationPreference).set({ email: true }).where(eq(notificationPreference.memberId, founder.id));
    await db.insert(notificationPreference).values({ memberId: founder.id, type: 'flag', email: true }).onConflictDoNothing();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice' });
    const alexToken = await signIn(await createInvitedMember(founder, 'Alex'));

    expect((await api('POST', `/api/v1/listings/${rice.id}/flags`, { token, body: { request: 'Hmm' } })).status).toBe(400);
    const flagged = await api('POST', `/api/v1/listings/${rice.id}/flags`, { token: alexToken, body: { request: 'Is this still good?' } });
    expect(flagged.status).toBe(204);
    expect(testOutbox.at(-1)).toMatchObject({ to: founder.email, subject: 'Alex sent a request about your listing' });

    // Others don't see flags; the owner does, and then they're marked seen.
    expect((await api('GET', `/api/v1/listings/${rice.id}`, { token: alexToken })).body.flags).toBeUndefined();
    const mine = await api('GET', '/api/v1/me/listings', { token });
    expect(mine.body.items[0].unseenFlags).toBe(1);
    const view = await api('GET', `/api/v1/listings/${rice.id}`, { token });
    expect(view.body.status).toBe('available');
    expect(view.body.flags).toEqual([expect.objectContaining({ request: 'Is this still good?', from: expect.objectContaining({ displayName: 'Alex' }) })]);
    expect((await api('GET', '/api/v1/me/listings', { token })).body.items[0].unseenFlags).toBe(0);
  });
});
