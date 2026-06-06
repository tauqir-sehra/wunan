// Offerings (US2; FR-007 to FR-014, FR-013a, FR-013b; contracts/api.md "Offerings").
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { offering, notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, signIn } from '../test/setup.ts';

async function owner() {
  const founder = await createFounder('Sam');
  return { founder, token: await signIn(founder) };
}

const create = (token: string, body: Record<string, unknown>) => api('POST', '/api/v1/offerings', { token, body });

describe('creating offerings', () => {
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
    expect(gift.body).toMatchObject({ amount: '5', unit: 'kg', remaining: '5', area: { label: 'Riverside', source: 'typed', display: 'Riverside' } });
    const lend = await create(token, { type: 'lend', title: 'Drill', amount: 1, unit: 'item', loanLength: 3, loanLengthUnit: 'days' });
    expect(lend.body).toMatchObject({ loanLength: 3, loanLengthUnit: 'days', remaining: null });
    const trade = await create(token, { type: 'trade', title: 'Sneakers', amount: '1', unit: 'item', accepts: [{ description: 'Leather boots' }] });
    expect(trade.body).toMatchObject({ accepts: [{ description: 'Leather boots', amount: null, unit: null }], remaining: '1' });
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

  it('lets a trade list up to 10 things it accepts, or none (open to offers)', async () => {
    const { token } = await owner();
    expect((await create(token, { type: 'trade', title: 'Sneakers' })).body.accepts).toEqual([]);
    const eleven = Array.from({ length: 11 }, (_, i) => ({ description: `Thing ${i}` }));
    expect((await create(token, { type: 'trade', title: 'Sneakers', accepts: eleven })).status).toBe(400);
    const noUnit = await create(token, { type: 'trade', title: 'Sneakers', accepts: [{ description: 'Eggs', amount: '6' }] });
    expect(noUnit.body.error.fields['accepts.0.unit']).toBe('Please choose a unit for the amount.');

    const starter = await create(token, { type: 'trade', title: 'Sourdough starter', accepts: [{ description: 'Eggs', amount: '6', unit: 'item' }, { description: 'Honey' }] });
    expect(starter.body.accepts.map((a: { description: string }) => a.description)).toEqual(['Eggs', 'Honey']);
    // Editing replaces the whole list.
    const edited = await api('PATCH', `/api/v1/offerings/${starter.body.id}`, { token, body: { accepts: [{ description: 'Jam' }] } });
    expect(edited.body.accepts.map((a: { description: string }) => a.description)).toEqual(['Jam']);
    const found = await api('GET', '/api/v1/offerings?q=jam', { token });
    expect(found.body.items.map((i: { title: string }) => i.title)).toEqual(['Sourdough starter']);
  });

  it('takes lb and oz, and service lengths in days and weeks', async () => {
    const { token } = await owner();
    expect((await create(token, { type: 'gift', title: 'Coffee', amount: '2', unit: 'lb' })).body.unit).toBe('lb');
    expect((await create(token, { type: 'gift', title: 'Tea', amount: '8', unit: 'oz' })).body.unit).toBe('oz');
    const course = await create(token, { type: 'service', title: 'Course', sessionLength: 2, sessionLengthUnit: 'days' });
    expect(course.body).toMatchObject({ sessionLength: 2, sessionLengthUnit: 'days' });
    expect((await create(token, { type: 'service', title: 'Retreat', sessionLength: 1, sessionLengthUnit: 'weeks' })).status).toBe(201);
  });

  it('needs a place for the handovers that happen at one', async () => {
    const { token } = await owner();
    const noArea = await create(token, { type: 'lend', title: 'Drill', handovers: ['at_lister'] });
    expect(noArea.body.error.fields.area).toBe('Please add your area so people know roughly where it is.');
    const noPlace = await create(token, { type: 'lend', title: 'Drill', handovers: ['elsewhere'] });
    expect(noPlace.body.error.fields.meetingPlace).toBe('Please add the place to meet.');
    const ok = await create(token, { type: 'lend', title: 'Drill', handovers: ['at_lister', 'online', 'online'], area: 'Riverside' });
    expect(ok.body.handovers).toEqual(['at_lister', 'online']);
  });

  it('shows others only the neighbourhood and city of a place', async () => {
    const { founder, token } = await owner();
    const house = { label: '1 Mill Street, Riverside, Springfield', source: 'suggestion', street: 'Mill Street', houseNumber: '1', neighbourhood: 'Riverside', city: 'Springfield' };
    const drill = await create(token, { type: 'lend', title: 'Drill', handovers: ['at_lister', 'elsewhere'], area: house, meetingPlace: { ...house, label: 'Riverside Library', name: 'Riverside Library' } });
    expect(drill.body.area).toMatchObject({ street: 'Mill Street', display: 'Riverside, Springfield' });

    const alex = await createInvitedMember(founder, 'Alex');
    const seen = await api('GET', `/api/v1/offerings/${drill.body.id}`, { token: await signIn(alex) });
    expect(seen.body.area).toEqual({ display: 'Riverside, Springfield' });
    expect(seen.body.meetingPlace).toEqual({ display: 'Riverside, Springfield' });
    const searched = await api('GET', '/api/v1/offerings?q=drill', { token: await signIn(alex) });
    expect(searched.body.items[0].area).toEqual({ display: 'Riverside, Springfield' });
    // Searching by street finds nothing: the filter never looks at the address.
    expect((await api('GET', '/api/v1/offerings?area=mill', { token })).body.items).toEqual([]);
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

    expect((await api('PATCH', `/api/v1/offerings/${rice.id}`, { token: other, body: { title: 'Mine' } })).status).toBe(403);
    expect((await api('PATCH', `/api/v1/offerings/${rice.id}`, { token, body: { type: 'lend' } })).status).toBe(400);

    const edited = await api('PATCH', `/api/v1/offerings/${rice.id}`, { token, body: { title: 'Brown rice', amount: '6' } });
    expect(edited.body).toMatchObject({ title: 'Brown rice', amount: '6', remaining: '6', unit: 'kg' });
    // Edits are checked against the type's rules.
    expect((await api('PATCH', `/api/v1/offerings/${rice.id}`, { token, body: { loanLength: 2 } })).status).toBe(400);
  });

  it('follows the status rules, and only the owner can change them', async () => {
    const { founder, token } = await owner();
    const { body: drill } = await create(token, { type: 'lend', title: 'Drill' });
    const other = await signIn(await createInvitedMember(founder, 'Alex'));
    const post = (change: string, t = token) => api('POST', `/api/v1/offerings/${drill.id}/${change}`, { token: t });

    expect((await post('pause', other)).status).toBe(403);
    expect((await post('resume')).status).toBe(409); // Not paused.
    expect((await post('pause')).body.status).toBe('paused');
    expect((await post('resume')).body.status).toBe('available');
    expect((await post('remove')).body).toMatchObject({ status: 'closed', closedReason: 'removed' });
    expect((await post('remove')).status).toBe(409);
  });

  it('reopens a removed offering with its remaining amount unchanged', async () => {
    const { token } = await owner();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    await db.update(offering).set({ remaining: '3' }).where(eq(offering.id, rice.id));
    await api('POST', `/api/v1/offerings/${rice.id}/remove`, { token });
    const reopened = await api('POST', `/api/v1/offerings/${rice.id}/reopen`, { token });
    expect(reopened.body).toMatchObject({ status: 'available', closedReason: null, remaining: '3' });
  });

  it("won't reopen an offering that closed because nothing was left", async () => {
    const { token } = await owner();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    await db.update(offering).set({ remaining: '0', status: 'closed', closedReason: 'used_up' }).where(eq(offering.id, rice.id));
    const result = await api('POST', `/api/v1/offerings/${rice.id}/reopen`, { token });
    expect(result.status).toBe(409);
    expect(result.body.error.message).toContain('create a new offering');
  });
});

describe('flags', () => {
  it("notify the owner, can't target your own offering, and leave the offering unchanged", async () => {
    const { founder, token } = await owner();
    await db.update(notificationPreference).set({ email: true }).where(eq(notificationPreference.memberId, founder.id));
    await db.insert(notificationPreference).values({ memberId: founder.id, type: 'flag', email: true }).onConflictDoNothing();
    const { body: rice } = await create(token, { type: 'gift', title: 'Rice' });
    const alexToken = await signIn(await createInvitedMember(founder, 'Alex'));

    expect((await api('POST', `/api/v1/offerings/${rice.id}/flags`, { token, body: { request: 'Hmm' } })).status).toBe(400);
    const flagged = await api('POST', `/api/v1/offerings/${rice.id}/flags`, { token: alexToken, body: { request: 'Is this still good?' } });
    expect(flagged.status).toBe(204);
    expect(testOutbox.at(-1)).toMatchObject({ to: founder.email, subject: 'Alex sent a request about your offering' });

    // Others don't see flags; the owner does, and then they're marked seen.
    expect((await api('GET', `/api/v1/offerings/${rice.id}`, { token: alexToken })).body.flags).toBeUndefined();
    const mine = await api('GET', '/api/v1/me/offerings', { token });
    expect(mine.body.items[0].unseenFlags).toBe(1);
    const view = await api('GET', `/api/v1/offerings/${rice.id}`, { token });
    expect(view.body.status).toBe('available');
    expect(view.body.flags).toEqual([expect.objectContaining({ request: 'Is this still good?', from: expect.objectContaining({ displayName: 'Alex' }) })]);
    expect((await api('GET', '/api/v1/me/offerings', { token })).body.items[0].unseenFlags).toBe(0);
  });
});
