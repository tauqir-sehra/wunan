// Proposals (002 US1; FR-010 to FR-021): making, changing, accepting, declining, withdrawing, and
// what happens to other proposals on the same offering.
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createOffering, futureDate, propose, signIn } from '../test/setup.ts';

async function setup() {
  const sam = await createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const ana = await createInvitedMember(sam, 'Ana');
  return { sam, robin, ana, samToken: await signIn(sam), robinToken: await signIn(robin), anaToken: await signIn(ana) };
}
const get = (token: string, id: string) => api('GET', `/api/v1/proposals/${id}`, { token });
const change = (token: string, id: string, body: Record<string, unknown>) => api('PATCH', `/api/v1/proposals/${id}`, { token, body });
const accept = async (token: string, id: string) => {
  const { version } = (await get(token, id)).body;
  return api('POST', `/api/v1/proposals/${id}/accept`, { token, body: { version } });
};

describe('making a proposal', () => {
  it('needs nothing filled in, lists what is missing, and starts a thread with the message', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill', loanLength: 3, loanLengthUnit: 'days' });
    const made = await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: robinToken, body: { message: 'Could I borrow it?' } });
    expect(made.status).toBe(201);

    const shown = await get(samToken, made.body.id);
    expect(shown.body).toMatchObject({ status: 'open', version: 1, canAccept: false, canEdit: false, myRole: 'lister' });
    expect(shown.body.issues.map((i: { field: string }) => i.field).sort()).toEqual(['date', 'handover', 'loanLength']);
    const messages = await api('GET', `/api/v1/conversations/${made.body.conversationId}/messages`, { token: samToken });
    expect(messages.body.items[0]).toMatchObject({ kind: 'text', body: 'Could I borrow it?' });
    expect((await get(robinToken, made.body.id)).body.canEdit).toBe(true);
  });

  it('is refused on your own offering, on a paused one, and twice by the same member', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    expect((await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: samToken, body: {} })).body.error.code).toBe('own_offering');
    const first = await propose(robinToken, drill.id);
    const again = await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: robinToken, body: {} });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'proposal_exists', proposalId: first.id });

    const ladder = await createOffering(samToken, { type: 'lend', title: 'Ladder' });
    await api('POST', `/api/v1/offerings/${ladder.id}/pause`, { token: samToken });
    expect((await api('POST', `/api/v1/offerings/${ladder.id}/proposals`, { token: robinToken, body: {} })).body.error.code).toBe('not_available');
  });

  it("refuses details that don't apply to the offering's type", async () => {
    const { samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const result = await api('POST', `/api/v1/offerings/${rice.id}/proposals`, { token: robinToken, body: { loanLength: 2, loanLengthUnit: 'days' } });
    expect(result.status).toBe(400);
    expect(result.body.error.fields.loanLength).toBe("This doesn't apply to this kind of offering.");
  });

  it('starts a gift at all that is left', async () => {
    const { samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const made = await propose(robinToken, rice.id);
    expect((await get(robinToken, made.id)).body.details.amount).toBe('5');
  });

  it('tells the lister, by email when they turned it on', async () => {
    const { sam, samToken, robinToken } = await setup();
    await db.insert(notificationPreference).values({ memberId: sam.id, type: 'message', email: true });
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    testOutbox.length = 0;
    await propose(robinToken, drill.id);
    expect(testOutbox.map((m) => m.subject)).toContain('Robin asked to borrow your Drill');
  });
});

describe('changing a proposal', () => {
  it('only the requester changes details; each change is noted in plain words', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill', loanLength: 3, loanLengthUnit: 'days' });
    const made = await propose(robinToken, drill.id);
    expect((await change(samToken, made.id, { loanLength: 1, loanLengthUnit: 'days' })).body.error.code).toBe('not_requester');

    const changed = await change(robinToken, made.id, { date: '2030-03-02', time: '10:00', loanLength: 3, loanLengthUnit: 'days' });
    expect(changed.status).toBe(200);
    expect(changed.body).toMatchObject({ version: 2, details: { date: '2030-03-02', time: '10:00', hasTime: true, loanLength: 3 } });
    const messages = await api('GET', `/api/v1/conversations/${made.conversationId}/messages`, { token: samToken });
    expect(messages.body.items[0]).toMatchObject({ kind: 'detail_changed' });
    expect(messages.body.items[0].body).toBe('Robin changed the pickup time to Saturday 2 March, 10 am, and how long to 3 days.');

    // Unchanged values change nothing.
    expect((await change(robinToken, made.id, { loanLength: 3 })).body.version).toBe(3);
    const after = await api('GET', `/api/v1/conversations/${made.conversationId}/messages`, { token: samToken });
    expect(after.body.items).toHaveLength(1);
  });

  it('clears a detail with null', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const made = await propose(robinToken, drill.id, { date: '2030-03-02' });
    const cleared = await change(robinToken, made.id, { date: null });
    expect(cleared.body.details).toMatchObject({ date: null, startsAt: null });
  });

  it('keeps others out', async () => {
    const { samToken, robinToken, anaToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const made = await propose(robinToken, drill.id);
    expect((await get(anaToken, made.id)).status).toBe(404);
    expect((await change(anaToken, made.id, { date: '2030-03-02' })).status).toBe(404);
  });
});

describe('accepting', () => {
  it('needs every detail, then makes the agreement with no further step', async () => {
    const { samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const made = await propose(robinToken, rice.id);
    const notReady = await accept(samToken, made.id);
    expect(notReady.status).toBe(409);
    expect(notReady.body.error.code).toBe('proposal_not_ready');
    expect(notReady.body.error.issues.length).toBeGreaterThan(0);

    await change(robinToken, made.id, completeDetails('gift', { amount: '2' }));
    expect((await accept(robinToken, made.id)).body.error.code).toBe('not_lister');
    const done = await accept(samToken, made.id);
    expect(done.status).toBe(200);
    const deal = await api('GET', `/api/v1/agreements/${done.body.agreementId}`, { token: robinToken });
    expect(deal.body).toMatchObject({ outcome: 'gifted', amount: '2', group: 'received' });
    expect((await api('GET', `/api/v1/offerings/${rice.id}`, { token: samToken })).body).toMatchObject({ remaining: '3', status: 'available' });
    expect((await get(robinToken, made.id)).body).toMatchObject({ status: 'accepted', agreementId: done.body.agreementId, canEdit: false });
  });

  it('refuses details the lister has not seen', async () => {
    const { samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    const made = await propose(robinToken, rice.id, completeDetails('gift'));
    const { version } = (await get(samToken, made.id)).body;
    await change(robinToken, made.id, { time: '11:00' });
    const stale = await api('POST', `/api/v1/proposals/${made.id}/accept`, { token: samToken, body: { version } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('proposal_changed');
    expect(stale.body.error.proposal.details.time).toBe('11:00');
  });

  it("can't be accepted when the time has passed or the loan is too long", async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill', loanLength: 2, loanLengthUnit: 'days' });
    const made = await propose(robinToken, drill.id, completeDetails('lend', { date: '2020-01-01', loanLength: 1, loanLengthUnit: 'weeks' }));
    const issues = (await get(samToken, made.id)).body.issues.map((i: { message: string }) => i.message);
    expect(issues).toContain('That time has passed. Please choose a new one.');
    expect(issues).toContain('Sam lends this for up to 2 days but your proposal of 1 week exceeds it.');
  });

  it('closes other proposals when nothing is left, and tells others when less is left', async () => {
    const { sam, samToken, robinToken, anaToken } = await setup();
    const kim = await createInvitedMember(sam, 'Kim');
    const kimToken = await signIn(kim);
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const robins = await propose(robinToken, rice.id, completeDetails('gift', { amount: '3' }));
    const anas = await propose(anaToken, rice.id, completeDetails('gift', { amount: '5' }));
    const kims = await propose(kimToken, rice.id, completeDetails('gift', { amount: '2' }));

    await accept(samToken, robins.id);
    const ana = (await get(anaToken, anas.id)).body;
    expect(ana.status).toBe('open');
    expect(ana.issues).toContainEqual({ field: 'amount', message: 'Only 2 kg is left.' });

    await accept(samToken, kims.id);
    const closed = (await get(anaToken, anas.id)).body;
    expect(closed).toMatchObject({ status: 'closed', closedReason: 'nothing_left' });
    const thread = await api('GET', `/api/v1/conversations/${closed.conversationId}/messages`, { token: anaToken });
    expect(thread.body.items[0].kind).toBe('closed');
    expect((await api('POST', `/api/v1/conversations/${closed.conversationId}/messages`, { token: anaToken, body: { body: 'Hello?' } })).body.error.code).toBe('thread_closed');
  });

  it('an offering without an amount closes when given', async () => {
    const { samToken, robinToken } = await setup();
    const sneakers = await createOffering(samToken, { type: 'trade', title: 'Sneakers' });
    await agree(samToken, robinToken, sneakers.id, completeDetails('trade'));
    expect((await api('GET', `/api/v1/offerings/${sneakers.id}`, { token: samToken })).body).toMatchObject({ status: 'closed', closedReason: 'used_up' });
  });

  it('a service uses its times and closes when none are left', async () => {
    const { samToken, robinToken, anaToken } = await setup();
    const repair = await createOffering(samToken, { type: 'service', title: 'Bike repair', sessionsAvailable: 2 });
    await agree(samToken, robinToken, repair.id, completeDetails('service', { sessions: 1 }));
    const anas = await propose(anaToken, repair.id, completeDetails('service', { sessions: 2 }));
    expect((await get(anaToken, anas.id)).body.issues).toContainEqual({ field: 'sessions', message: 'Only 1 time is left.' });
    await change(anaToken, anas.id, { sessions: 1 });
    await accept(samToken, anas.id);
    expect((await api('GET', `/api/v1/offerings/${repair.id}`, { token: samToken })).body).toMatchObject({ sessionsRemaining: 0, status: 'closed' });
  });
});

describe('loans', () => {
  it("can't overlap; later dates are fine, and other proposals stay open", async () => {
    const { samToken, robinToken, anaToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    await agree(samToken, robinToken, drill.id, completeDetails('lend', { date: futureDate(3), loanLength: 3, loanLengthUnit: 'days' }));
    const anas = await propose(anaToken, drill.id, completeDetails('lend', { date: futureDate(4), loanLength: 1, loanLengthUnit: 'days' }));
    const shown = (await get(samToken, anas.id)).body;
    expect(shown.status).toBe('open');
    expect(shown.issues.some((i: { message: string }) => i.message.startsWith("It's already lent then"))).toBe(true);

    await change(anaToken, anas.id, { date: futureDate(7) });
    expect((await accept(samToken, anas.id)).status).toBe(200);
    const offering = (await api('GET', `/api/v1/offerings/${drill.id}`, { token: anaToken })).body;
    expect(offering.takenPeriods).toHaveLength(2);
    expect(offering.lentOut).toBe(false); // Neither loan has started yet.
  });

  it('two overlapping accepts at the same moment: only one wins', async () => {
    const { sam, samToken, robinToken, anaToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const details = completeDetails('lend', { date: futureDate(3) });
    const a = await propose(robinToken, drill.id, details);
    const b = await propose(anaToken, drill.id, details);
    const [va, vb] = [(await get(samToken, a.id)).body.version, (await get(samToken, b.id)).body.version];
    const results = await Promise.all([
      api('POST', `/api/v1/proposals/${a.id}/accept`, { token: samToken, body: { version: va } }),
      api('POST', `/api/v1/proposals/${b.id}/accept`, { token: samToken, body: { version: vb } })
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    void sam;
  });
});

describe('declining and withdrawing', () => {
  it('ends the proposal, keeps a note, and makes the thread read-only', async () => {
    const { samToken, robinToken, anaToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const robins = await propose(robinToken, drill.id);
    expect((await api('POST', `/api/v1/proposals/${robins.id}/decline`, { token: robinToken, body: {} })).body.error.code).toBe('not_lister');
    const declined = await api('POST', `/api/v1/proposals/${robins.id}/decline`, { token: samToken, body: { note: "I'm using it that week." } });
    expect(declined.body).toMatchObject({ status: 'declined', decisionNote: "I'm using it that week." });
    expect((await change(robinToken, robins.id, { date: '2030-01-01' })).body.error.code).toBe('proposal_ended');

    const anas = await propose(anaToken, drill.id);
    const withdrawn = await api('POST', `/api/v1/proposals/${anas.id}/withdraw`, { token: anaToken, body: {} });
    expect(withdrawn.body.status).toBe('withdrawn');
    // A new proposal can be made once the old one ended.
    expect((await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: anaToken, body: {} })).status).toBe(201);
  });
});

describe('offering my proposals', () => {
  it('shows both sides, open first, with unread state', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    await propose(robinToken, drill.id, { message: 'Hi' });
    const riceProposal = await propose(robinToken, rice.id);
    await api('POST', `/api/v1/proposals/${riceProposal.id}/withdraw`, { token: robinToken, body: {} });

    const mine = await api('GET', '/api/v1/proposals?role=lister', { token: samToken });
    expect(mine.body.items.map((p: { offering: { title: string }; status: string }) => [p.offering.title, p.status])).toEqual([
      ['Drill', 'open'],
      ['Rice', 'withdrawn']
    ]);
    expect(mine.body.items[0]).toMatchObject({ unread: true, otherMember: { displayName: 'Robin' }, myRole: 'lister' });
    expect((await api('GET', '/api/v1/proposals?role=requester', { token: samToken })).body.items).toEqual([]);
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.proposalsWithNews).toBeGreaterThan(0);
  });
});
