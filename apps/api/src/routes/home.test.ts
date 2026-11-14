// Home (007): what needs a member, in four groups, from `GET /me/home`, and pressing a line with
// `POST /me/home/pressed`. Due-back day boundaries are tested with a fixed clock in modules/home.test.ts.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { arrangement, offering } from '../db/schema/index.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createOffering, propose, signIn } from '../test/setup.ts';

async function people() {
  const fay = await createFounder('Fay');
  const sam = await createInvitedMember(fay, 'Sam');
  const kim = await createInvitedMember(fay, 'Kim');
  const [fayToken, samToken, kimToken] = await Promise.all([signIn(fay), signIn(sam), signIn(kim)]);
  return { fay, sam, kim, fayToken, samToken, kimToken };
}

const home = async (token: string) => {
  const result = await api('GET', '/api/v1/me/home', { token });
  expect(result.status).toBe(200);
  return result.body;
};
const press = (token: string, body: Record<string, unknown>) => api('POST', '/api/v1/me/home/pressed', { token, body });
const day = 86_400_000;

async function askFor(token: string, title = 'Tent') {
  const result = await api('POST', '/api/v1/requests', { token, body: { kind: 'borrow', title } });
  expect(result.status).toBe(201);
  return result.body.id as string;
}
const link = (token: string, requestId: string, offeringId: string) =>
  api('POST', `/api/v1/requests/${requestId}/links`, { token, body: { offeringId } });

describe('GET /me/home', () => {
  it('needs signing in', async () => {
    expect((await api('GET', '/api/v1/me/home')).status).toBe(401);
  });

  it('is empty for a new member', async () => {
    const { fayToken } = await people();
    expect(await home(fayToken)).toEqual({ arrangements: [], dueBack: [], offers: [], askedToChange: [] });
  });
});

describe('arrangements (US1)', () => {
  it('lists exactly what "Waiting on you" lists, oldest first, and only mine', async () => {
    const { fayToken, samToken, kimToken } = await people();
    const ladder = await createOffering(fayToken, { type: 'lend', title: 'Ladder' });
    const drill = await createOffering(fayToken, { type: 'lend', title: 'Drill' });
    const ready = await propose(samToken, ladder.id, completeDetails('lend'));
    const later = await propose(kimToken, drill.id, completeDetails('lend'));
    // Sam's is older.
    await db.update(arrangement).set({ lastActivityAt: new Date(Date.now() - day) }).where(eq(arrangement.id, ready.id));

    const listed = await api('GET', '/api/v1/arrangements', { token: fayToken });
    const shown = await home(fayToken);
    expect(shown.arrangements.map((a: { id: string }) => a.id).sort()).toEqual(
      listed.body.needsYou.map((a: { id: string }) => a.id).sort()
    );
    expect(shown.arrangements.map((a: { id: string }) => a.id)).toEqual([ready.id, later.id]);
    // Sam waits on Fay: nothing on Sam's Home.
    expect((await home(samToken)).arrangements).toEqual([]);
  });
});

describe('due back (US3)', () => {
  it('lists a loan due within 2 days for both sides, once each, and not when returned', async () => {
    const { fayToken, samToken } = await people();
    const drill = await createOffering(fayToken, { type: 'lend', title: 'Drill' });
    const { arrangementId } = await agree(fayToken, samToken, drill.id, completeDetails('lend'));
    await db
      .update(arrangement)
      .set({ loanStartsAt: new Date(Date.now() - day), loanEndsAt: new Date(Date.now() + day) })
      .where(eq(arrangement.id, arrangementId));

    const sams = await home(samToken);
    expect(sams.dueBack).toEqual([
      expect.objectContaining({ arrangementId, myRole: 'requester', overdue: false, offering: { id: drill.id, title: 'Drill' }, otherMember: expect.objectContaining({ displayName: 'Fay' }) })
    ]);
    const fays = await home(fayToken);
    expect(fays.dueBack).toEqual([expect.objectContaining({ arrangementId, myRole: 'lister' })]);
    expect(fays.arrangements).toEqual([]);

    await api('POST', `/api/v1/arrangements/${arrangementId}/returned`, { token: fayToken });
    expect((await home(samToken)).dueBack).toEqual([]);
    expect((await home(fayToken)).dueBack).toEqual([]);
  });

  it("doesn't list a loan due later, and lists a late one under arrangements for the lender only", async () => {
    const { fayToken, samToken } = await people();
    const drill = await createOffering(fayToken, { type: 'lend', title: 'Drill' });
    const { arrangementId } = await agree(fayToken, samToken, drill.id, completeDetails('lend'));
    await db
      .update(arrangement)
      .set({ loanStartsAt: new Date(Date.now() - day), loanEndsAt: new Date(Date.now() + 5 * day) })
      .where(eq(arrangement.id, arrangementId));
    expect((await home(samToken)).dueBack).toEqual([]);

    await db
      .update(arrangement)
      .set({ loanStartsAt: new Date(Date.now() - 3 * day), loanEndsAt: new Date(Date.now() - day) })
      .where(eq(arrangement.id, arrangementId));
    expect((await home(samToken)).dueBack).toEqual([expect.objectContaining({ arrangementId, overdue: true })]);
    const fays = await home(fayToken);
    expect(fays.dueBack).toEqual([]);
    expect(fays.arrangements.map((a: { id: string }) => a.id)).toEqual([arrangementId]);
  });
});

describe('offers on your requests (US4)', () => {
  it('lists new offers per request until pressed on Home, not until seen', async () => {
    const { fayToken, samToken, kimToken } = await people();
    const requestId = await askFor(fayToken);
    const samsTent = await createOffering(samToken, { type: 'lend', title: 'Camping tent' });
    expect((await link(samToken, requestId, samsTent.id)).status).toBe(201);

    let offers = (await home(fayToken)).offers;
    expect(offers).toEqual([
      expect.objectContaining({ request: { id: requestId, title: 'Tent' }, count: 1, firstOffering: { id: samsTent.id, title: 'Camping tent' }, helpers: [expect.objectContaining({ displayName: 'Sam' })] })
    ]);

    // Opening the request elsewhere leaves it.
    await api('GET', `/api/v1/requests/${requestId}`, { token: fayToken });
    expect((await home(fayToken)).offers).toHaveLength(1);

    const kimsTent = await createOffering(kimToken, { type: 'lend', title: 'Big tent' });
    await link(kimToken, requestId, kimsTent.id);
    offers = (await home(fayToken)).offers;
    expect(offers[0]).toMatchObject({ count: 2, helpers: [{ displayName: 'Sam' }, { displayName: 'Kim' }] });

    expect((await press(fayToken, { kind: 'offers', requestId })).status).toBe(204);
    expect((await home(fayToken)).offers).toEqual([]);
    expect((await press(fayToken, { kind: 'offers', requestId })).status).toBe(204);

    // A new one brings it back, counting only the new one.
    const third = await createOffering(samToken, { type: 'lend', title: 'Small tent' });
    await link(samToken, requestId, third.id);
    expect((await home(fayToken)).offers[0]).toMatchObject({ count: 1, firstOffering: { title: 'Small tent' } });
  });

  it("leaves out closed requests, the asker's own links, and offerings that aren't available", async () => {
    const { fayToken, samToken } = await people();
    const requestId = await askFor(fayToken);
    const mine = await createOffering(fayToken, { type: 'lend', title: 'My own tent' });
    await link(fayToken, requestId, mine.id);
    expect((await home(fayToken)).offers).toEqual([]);

    const samsTent = await createOffering(samToken, { type: 'lend', title: 'Camping tent' });
    await link(samToken, requestId, samsTent.id);
    await db.update(offering).set({ status: 'paused' }).where(eq(offering.id, samsTent.id));
    expect((await home(fayToken)).offers).toEqual([]);

    await db.update(offering).set({ status: 'available' }).where(eq(offering.id, samsTent.id));
    expect((await home(fayToken)).offers).toHaveLength(1);
    await api('POST', `/api/v1/requests/${requestId}/close`, { token: fayToken });
    expect((await home(fayToken)).offers).toEqual([]);
  });

  it("can't press someone else's request", async () => {
    const { fayToken, samToken } = await people();
    const requestId = await askFor(fayToken);
    expect((await press(samToken, { kind: 'offers', requestId })).status).toBe(404);
  });
});

describe('asked to change (US5)', () => {
  it('lists requests to change my things until pressed on Home, and leaves the header counts alone', async () => {
    const { fayToken, samToken, kimToken } = await people();
    const drill = await createOffering(fayToken, { type: 'lend', title: 'Drill' });
    await api('POST', `/api/v1/offerings/${drill.id}/flags`, { token: samToken, body: { request: 'Is the battery included?' } });
    await api('POST', `/api/v1/offerings/${drill.id}/flags`, { token: kimToken, body: { request: 'Please add a photo.' } });
    const requestId = await askFor(fayToken, 'Ladder');
    await api('POST', `/api/v1/requests/${requestId}/flags`, { token: samToken, body: { request: 'How tall?' } });

    let asked = (await home(fayToken)).askedToChange;
    expect(asked).toEqual([
      expect.objectContaining({ subject: 'offering', id: drill.id, title: 'Drill', count: 2 }),
      expect.objectContaining({ subject: 'request', id: requestId, title: 'Ladder', count: 1 })
    ]);

    // Seeing them on the offering doesn't remove the line.
    await api('GET', `/api/v1/offerings/${drill.id}`, { token: fayToken });
    expect((await home(fayToken)).askedToChange).toHaveLength(2);

    const summaryBefore = (await api('GET', '/api/v1/me/summary', { token: fayToken })).body;
    expect((await press(fayToken, { kind: 'askedToChange', subject: 'offering', id: drill.id })).status).toBe(204);
    asked = (await home(fayToken)).askedToChange;
    expect(asked).toEqual([expect.objectContaining({ subject: 'request', id: requestId })]);
    expect((await api('GET', '/api/v1/me/summary', { token: fayToken })).body).toEqual(summaryBefore);

    // A new one brings it back.
    await api('POST', `/api/v1/offerings/${drill.id}/flags`, { token: kimToken, body: { request: 'Which bits?' } });
    // Oldest first: the request's line, then the drill's again.
    expect((await home(fayToken)).askedToChange).toEqual([
      expect.objectContaining({ id: requestId }),
      expect.objectContaining({ id: drill.id, count: 1 })
    ]);
  });

  it("can't press someone else's thing", async () => {
    const { fayToken, samToken } = await people();
    const drill = await createOffering(fayToken, { type: 'lend', title: 'Drill' });
    expect((await press(samToken, { kind: 'askedToChange', subject: 'offering', id: drill.id })).status).toBe(404);
  });
});

describe('helpers', () => {
  it("never sees an arrangement they only help with, even when it's late", async () => {
    // Invite chain Fay → Ana → Ben → Xan; Olu lends to Xan; Ben is asked to help.
    const fay = await createFounder('Fay');
    const ana = await createInvitedMember(fay, 'Ana');
    const ben = await createInvitedMember(ana, 'Ben');
    const xan = await createInvitedMember(ben, 'Xan');
    const olu = await createInvitedMember(fay, 'Olu');
    const [oluToken, xanToken, benToken] = await Promise.all([signIn(olu), signIn(xan), signIn(ben)]);
    const drill = await createOffering(oluToken, { type: 'lend', title: 'Drill' });
    const { arrangementId } = await agree(oluToken, xanToken, drill.id, completeDetails('lend'));
    await db
      .update(arrangement)
      .set({ loanStartsAt: new Date(Date.now() - 3 * day), loanEndsAt: new Date(Date.now() - day) })
      .where(eq(arrangement.id, arrangementId));
    await api('POST', `/api/v1/arrangements/${arrangementId}/reports`, { token: oluToken, body: { description: 'Not back yet.' } });
    expect((await api('GET', `/api/v1/arrangements/${arrangementId}`, { token: benToken })).body.myRole).toBe('helper');

    expect(await home(benToken)).toEqual({ arrangements: [], dueBack: [], offers: [], askedToChange: [] });
    // The borrower still sees it.
    expect((await home(xanToken)).dueBack).toEqual([expect.objectContaining({ arrangementId })]);
  });
});
