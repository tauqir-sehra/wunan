// Arrangements (002 US1, FR-010 to FR-021; 004): asking, changing, accepting, declining,
// withdrawing, what happens to others on the same offering, asking again, marking as done, and
// the grouped list.
import { describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { arrangement, notificationPreference } from '../db/schema/index.ts';
import { closeQuietArrangements } from '../modules/arrangements.ts';
import { testOutbox } from '../notify/email.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createOffering, futureDate, propose, signIn } from '../test/setup.ts';

async function setup() {
  const sam = await createFounder('Sam');
  const robin = await createInvitedMember(sam, 'Robin');
  const ana = await createInvitedMember(sam, 'Ana');
  return { sam, robin, ana, samToken: await signIn(sam), robinToken: await signIn(robin), anaToken: await signIn(ana) };
}
const get = (token: string, id: string) => api('GET', `/api/v1/arrangements/${id}`, { token });
const change = (token: string, id: string, body: Record<string, unknown>) => api('PATCH', `/api/v1/arrangements/${id}`, { token, body });
const accept = async (token: string, id: string) => {
  const { version } = (await get(token, id)).body;
  return api('POST', `/api/v1/arrangements/${id}/accept`, { token, body: { version } });
};

describe('making a proposal', () => {
  it('needs nothing filled in, lists what is missing, and starts a thread with the message', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill', loanLength: 3, loanLengthUnit: 'days' });
    const made = await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: robinToken, body: { message: 'Could I borrow it?' } });
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
    expect((await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: samToken, body: {} })).body.error.code).toBe('own_offering');
    const first = await propose(robinToken, drill.id);
    const again = await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: robinToken, body: {} });
    expect(again.status).toBe(409);
    expect(again.body.error).toMatchObject({ code: 'already_open', arrangementId: first.id });

    const ladder = await createOffering(samToken, { type: 'lend', title: 'Ladder' });
    await api('POST', `/api/v1/offerings/${ladder.id}/pause`, { token: samToken });
    expect((await api('POST', `/api/v1/offerings/${ladder.id}/arrangements`, { token: robinToken, body: {} })).body.error.code).toBe('not_available');
  });

  it("refuses details that don't apply to the offering's type", async () => {
    const { samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const result = await api('POST', `/api/v1/offerings/${rice.id}/arrangements`, { token: robinToken, body: { loanLength: 2, loanLengthUnit: 'days' } });
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
    expect(after.body.items.filter((m: { kind: string }) => m.kind === 'detail_changed')).toHaveLength(1);
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
    expect(notReady.body.error.code).toBe('arrangement_not_ready');
    expect(notReady.body.error.issues.length).toBeGreaterThan(0);

    await change(robinToken, made.id, completeDetails('gift', { amount: '2' }));
    expect((await accept(robinToken, made.id)).body.error.code).toBe('not_lister');
    const done = await accept(samToken, made.id);
    expect(done.status).toBe(200);
    // Accepting answers with the same arrangement, now agreed: no second thing is made.
    expect(done.body).toMatchObject({ id: made.id, status: 'agreed', stage: 'agreed' });
    const deal = await api('GET', `/api/v1/arrangements/${made.id}`, { token: robinToken });
    expect(deal.body).toMatchObject({ status: 'agreed', myRole: 'requester', details: { amount: '2' }, agreed: { returnedAt: null, doneAt: null } });
    expect(deal.body.agreed.at).toEqual(expect.any(String));
    expect((await api('GET', `/api/v1/offerings/${rice.id}`, { token: samToken })).body).toMatchObject({ remaining: '3', status: 'available' });
    expect((await get(robinToken, made.id)).body).toMatchObject({ status: 'agreed', canEdit: false });
  });

  it('refuses details the lister has not seen', async () => {
    const { samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    const made = await propose(robinToken, rice.id, completeDetails('gift'));
    const { version } = (await get(samToken, made.id)).body;
    await change(robinToken, made.id, { time: '11:00' });
    const stale = await api('POST', `/api/v1/arrangements/${made.id}/accept`, { token: samToken, body: { version } });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('arrangement_changed');
    expect(stale.body.error.arrangement.details.time).toBe('11:00');
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
      api('POST', `/api/v1/arrangements/${a.id}/accept`, { token: samToken, body: { version: va } }),
      api('POST', `/api/v1/arrangements/${b.id}/accept`, { token: samToken, body: { version: vb } })
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
    expect((await api('POST', `/api/v1/arrangements/${robins.id}/decline`, { token: robinToken, body: {} })).body.error.code).toBe('not_lister');
    const declined = await api('POST', `/api/v1/arrangements/${robins.id}/decline`, { token: samToken, body: { note: "I'm using it that week." } });
    expect(declined.body).toMatchObject({ status: 'declined', decisionNote: "I'm using it that week." });
    expect((await change(robinToken, robins.id, { date: '2030-01-01' })).body.error.code).toBe('arrangement_ended');

    const anas = await propose(anaToken, drill.id);
    const withdrawn = await api('POST', `/api/v1/arrangements/${anas.id}/withdraw`, { token: anaToken, body: {} });
    expect(withdrawn.body.status).toBe('withdrawn');
    // Asking again once it ended reopens the same arrangement (004 FR-010a); see "asking again" below.
    const again = await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: anaToken, body: {} });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: anas.id, reopened: true });
  });
});

describe('my arrangements', () => {
  it('shows both sides, with unread state, and ended ones under finished', async () => {
    const { samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    await propose(robinToken, drill.id, { message: 'Hi' });
    const riceProposal = await propose(robinToken, rice.id);
    await api('POST', `/api/v1/arrangements/${riceProposal.id}/withdraw`, { token: robinToken, body: {} });

    const mine = (await api('GET', '/api/v1/arrangements?side=offered', { token: samToken })).body;
    const pairs = (items: { offering: { title: string }; status: string }[]) => items.map((p) => [p.offering.title, p.status]);
    // Robin's message is unread, so the drill needs Sam; the withdrawn one is finished.
    expect(pairs(mine.needsYou)).toEqual([['Drill', 'open']]);
    expect(pairs(mine.finished)).toEqual([['Rice', 'withdrawn']]);
    expect(mine.needsYou[0]).toMatchObject({ unread: true, needsMe: true, stage: 'arranging', otherMember: { displayName: 'Robin' }, myRole: 'lister' });
    expect(mine.finished[0]).toMatchObject({ stage: 'ended', needsMe: false });
    const asked = (await api('GET', '/api/v1/arrangements?side=asked', { token: samToken })).body;
    expect([asked.needsYou, asked.inProgress, asked.finished]).toEqual([[], [], []]);
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.arrangementsNeedingYou).toBe(1);
  });
});

// ── 004: one arrangement from asking to the end ─────────────────────────────────────────────────

const steps = (body: { timeline: { step: string; at: string | null }[] }) => body.timeline.map((s) => (s.at ? s.step : `${s.step}?`));
const allOn = async (memberId: string) => {
  await db.insert(notificationPreference).values({ memberId, type: 'message', email: true }).onConflictDoNothing();
};

describe('asking again', () => {
  it('reopens the same arrangement with its messages, after a decline, a withdrawal, or a quiet close', async () => {
    const { sam, samToken, robinToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const made = await propose(robinToken, drill.id, { message: 'Could I borrow it?', ...completeDetails('lend') });
    await api('POST', `/api/v1/arrangements/${made.id}/decline`, { token: samToken, body: { note: "I'm using it that week." } });
    expect((await get(robinToken, made.id)).body).toMatchObject({ status: 'declined', stage: 'ended', canAskAgain: true, canEdit: false });
    expect((await get(samToken, made.id)).body.canAskAgain).toBe(false);
    const closedThread = await api('POST', `/api/v1/conversations/${made.conversationId}/messages`, { token: robinToken, body: { body: 'Hello?' } });
    expect(closedThread.body.error.code).toBe('thread_closed');

    await allOn(sam.id);
    testOutbox.length = 0;
    const again = await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: robinToken, body: { loanLength: 1, loanLengthUnit: 'days' } });
    expect(again.status).toBe(200);
    expect(again.body).toMatchObject({ id: made.id, conversationId: made.conversationId, reopened: true });
    const shown = (await get(robinToken, made.id)).body;
    // Only what was asked this time: the earlier date and handover are gone, and so is the note.
    expect(shown).toMatchObject({ status: 'open', stage: 'arranging', version: 2, decisionNote: null, closedReason: null, canAskAgain: false, canEdit: true });
    expect(shown.details).toMatchObject({ loanLength: 1, startsAt: null, handover: null });
    expect(steps(shown)).toEqual(['asked', 'declined', 'asked', 'agreed?']);
    // The conversation carries on, earlier messages included, and the lister is told.
    const messages = await api('GET', `/api/v1/conversations/${made.conversationId}/messages`, { token: samToken });
    expect(messages.body.conversation.canWrite).toBe(true);
    expect(messages.body.items.map((m: { body: string }) => m.body)).toContain('Could I borrow it?');
    expect(testOutbox.at(-1)?.subject).toBe('Robin asked again to borrow your Drill');
    expect((await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: robinToken, body: {} })).body.error.code).toBe('already_open');

    // After withdrawing, and after a quiet-month close, the same again.
    await api('POST', `/api/v1/arrangements/${made.id}/withdraw`, { token: robinToken, body: {} });
    expect((await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: robinToken, body: {} })).body).toMatchObject({ id: made.id, reopened: true });
    await db.update(arrangement).set({ lastActivityAt: new Date(Date.now() - 31 * 86_400_000) }).where(eq(arrangement.id, made.id));
    await closeQuietArrangements();
    expect((await get(robinToken, made.id)).body).toMatchObject({ status: 'closed', closedReason: 'quiet' });
    expect((await api('POST', `/api/v1/offerings/${drill.id}/arrangements`, { token: robinToken, body: {} })).body).toMatchObject({ id: made.id, reopened: true });
    expect((await get(robinToken, made.id)).body.version).toBe(4);
  });

  it('starts a new arrangement after an agreement, and the database keeps one that is not agreed', async () => {
    const { robin, samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const first = await agree(samToken, robinToken, rice.id, completeDetails('gift', { amount: '1' }));
    const second = await api('POST', `/api/v1/offerings/${rice.id}/arrangements`, { token: robinToken, body: {} });
    expect(second.status).toBe(201);
    expect(second.body.id).not.toBe(first.arrangementId);
    expect((await api('GET', `/api/v1/offerings/${rice.id}`, { token: robinToken })).body.myArrangement).toEqual({ id: second.body.id, status: 'open' });
    await expect(db.insert(arrangement).values({ offeringId: rice.id, requesterId: robin.id })).rejects.toThrow();
  });
});

describe('marking as done', () => {
  it('either member marks an agreed gift done or not done; nobody is notified and nothing else changes', async () => {
    const { sam, robin, samToken, robinToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const open = await propose(robinToken, rice.id, completeDetails('gift', { amount: '2' }));
    expect((await api('POST', `/api/v1/arrangements/${open.id}/done`, { token: robinToken })).body.error.code).toBe('not_agreed');
    await accept(samToken, open.id);
    await api('POST', `/api/v1/conversations/${open.conversationId}/read`, { token: samToken });
    await allOn(sam.id);
    await allOn(robin.id);
    testOutbox.length = 0;

    const done = await api('POST', `/api/v1/arrangements/${open.id}/done`, { token: robinToken });
    expect(done.status).toBe(200);
    expect(done.body).toMatchObject({ stage: 'done', status: 'agreed', agreed: { doneBy: { displayName: 'Robin' } } });
    expect(done.body.agreed.doneAt).toEqual(expect.any(String));
    expect(steps(done.body)).toEqual(['asked', 'agreed', 'done']);
    expect((await api('POST', `/api/v1/arrangements/${open.id}/done`, { token: samToken })).body.error.code).toBe('already_done');
    expect(testOutbox).toHaveLength(0);
    // Finished for both, and the note wunan wrote doesn't make it "need" Sam.
    const sams = (await api('GET', '/api/v1/arrangements', { token: samToken })).body;
    expect(sams.needsYou).toEqual([]);
    expect(sams.finished[0]).toMatchObject({ id: open.id, stage: 'done', needsMe: false, unread: false });
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.arrangementsNeedingYou).toBe(0);
    expect((await api('GET', `/api/v1/offerings/${rice.id}`, { token: samToken })).body.remaining).toBe('3');

    // Either of them can take it back.
    const back = await api('POST', `/api/v1/arrangements/${open.id}/not-done`, { token: samToken });
    expect(back.body).toMatchObject({ stage: 'agreed', agreed: { doneAt: null, doneBy: null } });
    expect(steps(back.body)).toEqual(['asked', 'agreed', 'done?']);
    expect((await api('POST', `/api/v1/arrangements/${open.id}/not-done`, { token: samToken })).body.error.code).toBe('not_done');
    expect((await api('GET', '/api/v1/arrangements', { token: samToken })).body.inProgress[0]).toMatchObject({ id: open.id, stage: 'agreed' });
    expect(testOutbox).toHaveLength(0);
  });

  it('is not for loans, and not for anyone else', async () => {
    const { samToken, robinToken, anaToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const loan = await agree(samToken, robinToken, drill.id, completeDetails('lend'));
    expect((await api('POST', `/api/v1/arrangements/${loan.arrangementId}/done`, { token: samToken })).body.error.code).toBe('is_a_loan');
    expect((await api('POST', `/api/v1/arrangements/${loan.arrangementId}/done`, { token: anaToken })).status).toBe(404);
    expect((await api('POST', `/api/v1/arrangements/${loan.arrangementId}/not-done`, { token: anaToken })).status).toBe(404);
  });
});

describe('the list', () => {
  it('groups each arrangement once, newest first, and filters by side', async () => {
    const { samToken, robinToken, anaToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    const tent = await createOffering(robinToken, { type: 'lend', title: 'Tent' });
    await propose(robinToken, drill.id); // details missing: needs Robin
    await propose(anaToken, rice.id, completeDetails('gift')); // ready: needs Sam
    await propose(samToken, tent.id, completeDetails('lend')); // Sam asked: waiting for Robin

    const titles = (items: { offering: { title: string } }[]) => items.map((a) => a.offering.title);
    const sams = (await api('GET', '/api/v1/arrangements', { token: samToken })).body;
    expect(titles(sams.needsYou)).toEqual(['Rice']);
    expect(titles(sams.inProgress)).toEqual(['Tent', 'Drill']);
    expect(sams.finished).toEqual([]);
    expect(sams.finishedNext).toBeNull();
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.arrangementsNeedingYou).toBe(1);
    const robins = (await api('GET', '/api/v1/arrangements', { token: robinToken })).body;
    expect(titles(robins.needsYou)).toEqual(['Tent', 'Drill']);

    const asked = (await api('GET', '/api/v1/arrangements?side=asked', { token: samToken })).body;
    expect([titles(asked.needsYou), titles(asked.inProgress)]).toEqual([[], ['Tent']]);
    const offered = (await api('GET', '/api/v1/arrangements?side=offered', { token: samToken })).body;
    expect([titles(offered.needsYou), titles(offered.inProgress)]).toEqual([['Rice'], ['Drill']]);
    expect((await api('GET', '/api/v1/arrangements?side=sideways', { token: samToken })).status).toBe(400);
  });

  it('pages finished arrangements 20 at a time', async () => {
    const { samToken, robinToken } = await setup();
    for (let i = 0; i < 25; i += 1) {
      const item = await createOffering(samToken, { type: 'gift', title: `Thing ${i}` });
      const made = await propose(robinToken, item.id);
      await api('POST', `/api/v1/arrangements/${made.id}/withdraw`, { token: robinToken, body: {} });
    }
    const first = (await api('GET', '/api/v1/arrangements', { token: samToken })).body;
    expect(first.finished).toHaveLength(20);
    expect(first.finished[0].offering.title).toBe('Thing 24');
    expect(first.finishedNext).toEqual(expect.any(String));
    const rest = (await api('GET', `/api/v1/arrangements?group=finished&cursor=${first.finishedNext}`, { token: samToken })).body;
    expect(rest.finished).toHaveLength(5);
    expect(rest.finishedNext).toBeNull();
    expect([rest.needsYou, rest.inProgress]).toEqual([[], []]);
  }, 60_000);
});

describe('notices', () => {
  it('link to the arrangement, and say what happened in plain words', async () => {
    const { sam, robin, samToken, robinToken } = await setup();
    await allOn(sam.id);
    await allOn(robin.id);
    await db.insert(notificationPreference).values({ memberId: robin.id, type: 'agreement', email: true });
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    testOutbox.length = 0;
    const made = await propose(robinToken, drill.id);
    await change(robinToken, made.id, completeDetails('lend'));
    await accept(samToken, made.id);
    const subjects = testOutbox.map((m) => m.subject);
    // The detail change falls under the once-per-conversation-per-hour limit, so it sends nothing more.
    expect(subjects).toEqual(['Robin asked to borrow your Drill', "Sam accepted: you've agreed on Drill"]);
    // Every notice about it opens the arrangement; none points at a proposals or agreements page.
    expect(testOutbox.length).toBeGreaterThan(0);
    for (const mail of testOutbox) {
      expect(mail.text).toContain(`/arrangements/${made.id}`);
      expect(mail.text).not.toMatch(/\/(proposals|agreements)\//);
    }

    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    const asked = await propose(robinToken, rice.id);
    testOutbox.length = 0;
    await api('POST', `/api/v1/arrangements/${asked.id}/decline`, { token: samToken, body: {} });
    expect(testOutbox.at(-1)).toMatchObject({ subject: 'Sam declined what you asked for Rice' });
    expect(testOutbox.at(-1)!.text).toContain(`/arrangements/${asked.id}`);
  });
});
