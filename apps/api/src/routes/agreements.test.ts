// Agreements (US5; FR-022 to FR-026, FR-024a).
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, signIn } from '../test/setup.ts';

async function setup() {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const samToken = await signIn(sam);
  const alexToken = await signIn(alex);
  const make = async (body: Record<string, unknown>) => (await api('POST', '/api/v1/listings', { token: samToken, body })).body as { id: string };
  const record = (listingId: string, body: Record<string, unknown>, token = samToken) =>
    api('POST', `/api/v1/listings/${listingId}/agreements`, { token, body: { otherMemberId: alex.id, ...body } });
  const listingOf = async (id: string) => (await api('GET', `/api/v1/listings/${id}`, { token: samToken })).body;
  return { sam, alex, samToken, alexToken, make, record, listingOf };
}

describe('recording agreements', () => {
  it('only the owner records, and not with themselves', async () => {
    const { sam, alexToken, make, record } = await setup();
    const rice = await make({ type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    expect((await record(rice.id, { amount: '1' }, alexToken)).status).toBe(403);
    expect((await record(rice.id, { otherMemberId: sam.id, amount: '1' })).status).toBe(400);
  });

  it('a gift with an amount reduces what is left, and closes at zero', async () => {
    const { make, record, listingOf } = await setup();
    const rice = await make({ type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const given = await record(rice.id, { amount: '2' });
    expect(given.status).toBe(201);
    expect(given.body).toMatchObject({ outcome: 'gifted', amount: '2', confirmation: 'pending', group: 'given' });
    expect(await listingOf(rice.id)).toMatchObject({ remaining: '3', status: 'available' });

    expect((await record(rice.id, {})).body.error.fields.amount).toBe('Please say how much.');
    const tooMuch = await record(rice.id, { amount: '4' });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.error.code).toBe('not_enough_remaining');

    await record(rice.id, { amount: '3' });
    expect(await listingOf(rice.id)).toMatchObject({ remaining: '0', status: 'closed', closedReason: 'used_up' });
  });

  it('cannot over-allocate when two agreements are recorded at once', async () => {
    const { make, record, listingOf } = await setup();
    const rice = await make({ type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const results = await Promise.all([record(rice.id, { amount: '3' }), record(rice.id, { amount: '3' })]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await listingOf(rice.id)).remaining).toBe('2');
  });

  it('a listing without an amount closes when given or traded', async () => {
    const { make, record, listingOf } = await setup();
    const trade = await make({ type: 'trade', title: 'Sneakers', openToOffers: true });
    expect((await record(trade.id, {})).body.outcome).toBe('traded');
    expect(await listingOf(trade.id)).toMatchObject({ status: 'closed', closedReason: 'used_up' });
  });

  it('a loan needs a return date, lends the item out, and only the owner marks it returned', async () => {
    const { alexToken, samToken, make, record, listingOf } = await setup();
    const drill = await make({ type: 'lend', title: 'Drill' });
    expect((await record(drill.id, {})).body.error.fields.returnDue).toBe('Please choose the return date.');
    const loan = await record(drill.id, { returnDue: '2030-01-10' });
    expect(loan.body).toMatchObject({ outcome: 'lent', returnDue: '2030-01-10', group: 'lent' });
    expect((await listingOf(drill.id)).status).toBe('lent_out');

    expect((await api('POST', `/api/v1/agreements/${loan.body.id}/returned`, { token: alexToken })).status).toBe(403);
    const returned = await api('POST', `/api/v1/agreements/${loan.body.id}/returned`, { token: samToken });
    expect(returned.body.returnedAt).toBeTruthy();
    expect((await listingOf(drill.id)).status).toBe('available');
  });

  it('only loans can be marked returned', async () => {
    const { samToken, make, record } = await setup();
    const rice = await make({ type: 'gift', title: 'Rice' });
    const { body } = await record(rice.id, {});
    expect((await api('POST', `/api/v1/agreements/${body.id}/returned`, { token: samToken })).status).toBe(400);
  });

  it('a service uses 1 session by default and closes when none are left', async () => {
    const { make, record, listingOf } = await setup();
    const bodywork = await make({ type: 'service', title: 'Bodywork', sessionsAvailable: 3 });
    expect((await record(bodywork.id, {})).body).toMatchObject({ outcome: 'provided', sessions: 1 });
    expect((await listingOf(bodywork.id)).sessionsRemaining).toBe(2);
    expect((await record(bodywork.id, { sessions: 3 })).status).toBe(409);
    await record(bodywork.id, { sessions: 2 });
    expect(await listingOf(bodywork.id)).toMatchObject({ sessionsRemaining: 0, status: 'closed' });
  });

  it("can't be recorded on a paused listing", async () => {
    const { samToken, make, record } = await setup();
    const rice = await make({ type: 'gift', title: 'Rice' });
    await api('POST', `/api/v1/listings/${rice.id}/pause`, { token: samToken });
    expect((await record(rice.id, {})).status).toBe(409);
  });
});

describe('answering and history', () => {
  it('only the other member confirms or disputes; disputes notify the owner', async () => {
    const { sam, samToken, alexToken, make, record } = await setup();
    await db.insert(notificationPreference).values({ memberId: sam.id, type: 'agreement', email: true });
    const rice = await make({ type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const first = (await record(rice.id, { amount: '1' })).body;
    expect((await api('POST', `/api/v1/agreements/${first.id}/confirm`, { token: samToken })).status).toBe(403);
    expect((await api('POST', `/api/v1/agreements/${first.id}/confirm`, { token: alexToken })).body.confirmation).toBe('confirmed');
    expect((await api('POST', `/api/v1/agreements/${first.id}/dispute`, { token: alexToken })).status).toBe(409);

    const second = (await record(rice.id, { amount: '1' })).body;
    await api('POST', `/api/v1/agreements/${second.id}/dispute`, { token: alexToken });
    expect(testOutbox.at(-1)).toMatchObject({ to: sam.email, subject: 'Alex said an agreement needs a correction' });
  });

  it('tells the other member when an agreement is recorded', async () => {
    const { alex, make, record } = await setup();
    await db.insert(notificationPreference).values({ memberId: alex.id, type: 'agreement', email: true });
    const rice = await make({ type: 'gift', title: 'Rice' });
    await record(rice.id, {});
    expect(testOutbox.at(-1)).toMatchObject({ to: alex.email, subject: 'Sam recorded an agreement with you' });
  });

  it("groups history from each person's side and counts what needs attention", async () => {
    const { samToken, alexToken, make, record } = await setup();
    const drill = await make({ type: 'lend', title: 'Drill' });
    const rice = await make({ type: 'gift', title: 'Rice' });
    await record(drill.id, { returnDue: '2020-01-01' }); // Overdue.
    await record(rice.id, {});
    const samGroups = (await api('GET', '/api/v1/me/agreements', { token: samToken })).body.items.map((a: { group: string }) => a.group).sort();
    const alexItems = (await api('GET', '/api/v1/me/agreements', { token: alexToken })).body.items;
    expect(samGroups).toEqual(['given', 'lent']);
    expect(alexItems.map((a: { group: string }) => a.group).sort()).toEqual(['borrowed', 'received']);
    expect(alexItems.find((a: { group: string }) => a.group === 'borrowed').overdue).toBe(true);
    // Alex: two waiting for an answer (the overdue loan is one of them). Sam: the overdue loan.
    expect((await api('GET', '/api/v1/me/summary', { token: alexToken })).body.agreementsNeedingAttention).toBe(2);
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.agreementsNeedingAttention).toBe(1);
  });

  it('lists people who messaged about the listing as candidates', async () => {
    const { sam, alex, samToken, alexToken, make } = await setup();
    const rice = await make({ type: 'gift', title: 'Rice' });
    await api('POST', '/api/v1/conversations', { token: alexToken, body: { memberId: sam.id, listingId: rice.id } });
    const candidates = await api('GET', `/api/v1/listings/${rice.id}/agreement-candidates`, { token: samToken });
    expect(candidates.body.items).toEqual([{ id: alex.id, displayName: 'Alex' }]);
    expect((await api('GET', `/api/v1/listings/${rice.id}/agreement-candidates`, { token: alexToken })).status).toBe(403);
  });

  it('keeps agreements private to the two people', async () => {
    const { sam, make, record } = await setup();
    const robin = await signIn(await createInvitedMember(sam, 'Robin'));
    const rice = await make({ type: 'gift', title: 'Rice' });
    const { body } = await record(rice.id, {});
    expect((await api('GET', `/api/v1/agreements/${body.id}`, { token: robin })).status).toBe(404);
  });
});

describe('cancelling', () => {
  it('the owner can cancel a pending agreement, which undoes its effects and tells the other member', async () => {
    const { alex, samToken, alexToken, make, record, listingOf } = await setup();
    await db.insert(notificationPreference).values({ memberId: alex.id, type: 'agreement', email: true });
    const rice = await make({ type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const all = (await record(rice.id, { amount: '5' })).body;
    expect((await listingOf(rice.id)).status).toBe('closed');

    expect((await api('POST', `/api/v1/agreements/${all.id}/cancel`, { token: alexToken })).status).toBe(403);
    const cancelled = await api('POST', `/api/v1/agreements/${all.id}/cancel`, { token: samToken });
    expect(cancelled.body.confirmation).toBe('cancelled');
    expect(await listingOf(rice.id)).toMatchObject({ remaining: '5', status: 'available', closedReason: null });
    expect(testOutbox.at(-1)).toMatchObject({ to: alex.email, subject: 'Sam cancelled an agreement with you' });
  });

  it('restores sessions and loans too, but not once answered', async () => {
    const { samToken, alexToken, make, record, listingOf } = await setup();
    const bodywork = await make({ type: 'service', title: 'Bodywork', sessionsAvailable: 2 });
    const session = (await record(bodywork.id, { sessions: 2 })).body;
    await api('POST', `/api/v1/agreements/${session.id}/cancel`, { token: samToken });
    expect(await listingOf(bodywork.id)).toMatchObject({ sessionsRemaining: 2, status: 'available' });

    const drill = await make({ type: 'lend', title: 'Drill' });
    const loan = (await record(drill.id, { returnDue: '2030-01-01' })).body;
    await api('POST', `/api/v1/agreements/${loan.id}/confirm`, { token: alexToken });
    expect((await api('POST', `/api/v1/agreements/${loan.id}/cancel`, { token: samToken })).status).toBe(409);
  });
});
