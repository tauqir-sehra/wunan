// Requests (003): asking, editing, closing, reopening (US1); suggestions (US2); links (US3);
// browsing (US5); flags (US7).
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, createOffering, futureDate, signIn } from '../test/setup.ts';

const riverside = { label: 'Riverside, Springfield', source: 'suggestion', neighbourhood: 'Riverside', city: 'Springfield' };

async function people() {
  const rana = await createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const kim = await createInvitedMember(rana, 'Kim');
  const [ranaToken, samToken, kimToken] = await Promise.all([signIn(rana), signIn(sam), signIn(kim)]);
  return { rana, sam, kim, ranaToken, samToken, kimToken };
}

async function ask(token: string, body: Record<string, unknown>) {
  const result = await api('POST', '/api/v1/requests', { token, body });
  if (result.status !== 201) throw new Error(`Request failed: ${result.status} ${JSON.stringify(result.body)}`);
  return result.body.id as string;
}

async function emailOn(memberId: string, type: string) {
  await db.insert(notificationPreference).values({ memberId, type: type as 'request', email: true }).onConflictDoUpdate({
    target: [notificationPreference.memberId, notificationPreference.type],
    set: { email: true }
  });
}

const yesterday = () => {
  const d = new Date(Date.now() - 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('asking (US1)', () => {
  it('posts each kind with only a title, and with every detail', async () => {
    const { ranaToken, samToken } = await people();
    for (const kind of ['borrow', 'receive', 'trade', 'service']) {
      const id = await ask(ranaToken, { kind, title: `Just a ${kind}` });
      const shown = await api('GET', `/api/v1/requests/${id}`, { token: samToken });
      expect(shown.body).toMatchObject({ kind, title: `Just a ${kind}`, status: 'open', neededAfter: null, neededBy: null, links: [], canAnswer: true, canEdit: false });
    }
    const full = {
      borrow: { loanLength: 1, loanLengthUnit: 'days' },
      receive: { amount: '5', unit: 'lb' },
      trade: { amount: 1, unit: 'item', giveBack: [{ description: 'Jam', amount: 2, unit: 'item' }, { description: 'Eggs' }] },
      service: { sessionLength: 2, sessionLengthUnit: 'hours', sessions: 1, availability: [{ weekday: 6, startTime: '10:00', endTime: '12:00' }] }
    };
    for (const [kind, extra] of Object.entries(full)) {
      const id = await ask(ranaToken, {
        kind,
        title: `Full ${kind}`,
        description: 'Please',
        neededAfter: futureDate(2),
        neededBy: futureDate(4),
        area: riverside,
        handovers: ['to_requester', 'online'],
        ...extra
      });
      const shown = await api('GET', `/api/v1/requests/${id}`, { token: samToken });
      expect(shown.body).toMatchObject({ description: 'Please', neededAfter: futureDate(2), neededBy: futureDate(4), handovers: ['to_requester', 'online'] });
      // Others see only the neighbourhood and city.
      expect(shown.body.area).toEqual({ display: 'Riverside, Springfield' });
    }
    const trade = (await api('GET', '/api/v1/requests?mine=true', { token: ranaToken })).body.items.find((r: { title: string }) => r.title === 'Full trade');
    const detail = await api('GET', `/api/v1/requests/${trade.id}`, { token: ranaToken });
    expect(detail.body.giveBack).toEqual([
      { description: 'Jam', amount: '2', unit: 'item' },
      { description: 'Eggs', amount: null, unit: null }
    ]);
    expect(detail.body.area).toMatchObject({ label: 'Riverside, Springfield' });
  });

  it('refuses requests that break the rules, with plain messages', async () => {
    const { ranaToken } = await people();
    const noTitle = await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: '' } });
    expect(noTitle.status).toBe(400);
    expect(noTitle.body.error.fields.title).toBe('Please add a title.');
    const long = await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: 'x'.repeat(101) } });
    expect(long.body.error.fields.title).toMatch(/100 characters/);
    const dates = await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: 'Drill', neededAfter: futureDate(5), neededBy: futureDate(2) } });
    expect(dates.status).toBe(400);
    expect(dates.body.error.fields).toMatchObject({ neededBy: expect.stringContaining('before'), neededAfter: expect.stringContaining('before') });
    const wrongField = await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: 'Drill', amount: 2, unit: 'item' } });
    expect(wrongField.status).toBe(400);
    const tooMany = await api('POST', '/api/v1/requests', {
      token: ranaToken,
      body: { kind: 'trade', title: 'Swap', giveBack: Array.from({ length: 11 }, (_, i) => ({ description: `Thing ${i}` })) }
    });
    expect(tooMany.status).toBe(400);
  });

  it('lets only the asker edit, close, and reopen', async () => {
    const { ranaToken, samToken } = await people();
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill' });
    expect((await api('PATCH', `/api/v1/requests/${id}`, { token: samToken, body: { title: 'Mine' } })).status).toBe(403);
    const edited = await api('PATCH', `/api/v1/requests/${id}`, { token: ranaToken, body: { neededAfter: futureDate(3), neededBy: futureDate(3) } });
    expect(edited.status).toBe(200);
    expect(edited.body).toMatchObject({ title: 'Drill', neededAfter: futureDate(3), neededBy: futureDate(3) });
    expect((await api('PATCH', `/api/v1/requests/${id}`, { token: ranaToken, body: { kind: 'receive' } })).status).toBe(400);

    expect((await api('POST', `/api/v1/requests/${id}/close`, { token: samToken })).status).toBe(403);
    const closed = await api('POST', `/api/v1/requests/${id}/close`, { token: ranaToken });
    expect(closed.body).toMatchObject({ status: 'closed', closedReason: 'by_asker', canEdit: false });
    expect((await api('PATCH', `/api/v1/requests/${id}`, { token: ranaToken, body: { title: 'Later' } })).status).toBe(409);
    expect((await api('POST', `/api/v1/requests/${id}/close`, { token: ranaToken })).status).toBe(409);
    const reopened = await api('POST', `/api/v1/requests/${id}/reopen`, { token: ranaToken });
    expect(reopened.body).toMatchObject({ status: 'open', closedReason: null, canEdit: true });
    expect((await api('POST', `/api/v1/requests/${id}/close`, { token: ranaToken })).status).toBe(200);
  });

  it('tells members who linked an offering about edits, closing, and reopening, but not the asker', async () => {
    const { rana, sam, ranaToken, samToken } = await people();
    await emailOn(sam.id, 'request');
    await emailOn(rana.id, 'request');
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill' });
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    await api('POST', `/api/v1/requests/${id}/links`, { token: samToken, body: { offeringId: drill.id } });
    const toSam = () => testOutbox.filter((e) => e.to === sam.email).map((e) => e.subject);
    const toRana = () => testOutbox.filter((e) => e.to === rana.email).map((e) => e.subject);

    await api('PATCH', `/api/v1/requests/${id}`, { token: ranaToken, body: { description: 'For shelves' } });
    expect(toSam()).toEqual(['Rana changed their request “Drill”']);
    expect(testOutbox.find((e) => e.to === sam.email)!.text).toContain('the description');
    // Once an hour at most for each request.
    await api('POST', `/api/v1/requests/${id}/close`, { token: ranaToken });
    expect(toSam()).toHaveLength(1);
    expect(toRana()).toEqual(['Sam can help with “Drill”']);
  });

  it('says when "Needed by" has passed, to the asker only', async () => {
    const { ranaToken, samToken } = await people();
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill', neededBy: yesterday() });
    expect((await api('GET', `/api/v1/requests/${id}`, { token: ranaToken })).body.datePassed).toBe(true);
    expect((await api('GET', `/api/v1/requests/${id}`, { token: samToken })).body.datePassed).toBe(false);
  });
});

describe('suggestions while asking (US2)', () => {
  it('suggests available offerings of the matching type by others, area matches first', async () => {
    const { ranaToken, samToken, kimToken } = await people();
    await createOffering(samToken, { type: 'lend', title: 'Cordless drill' });
    await createOffering(kimToken, { type: 'lend', title: 'Hammer drill', area: riverside });
    await createOffering(samToken, { type: 'gift', title: 'Drill bits' });
    await createOffering(ranaToken, { type: 'lend', title: 'My own drill' });
    const paused = await createOffering(samToken, { type: 'lend', title: 'Paused drill' });
    await api('POST', `/api/v1/offerings/${paused.id}/pause`, { token: samToken });

    const found = await api('GET', '/api/v1/requests/suggestions?kind=borrow&q=drill&area=riverside', { token: ranaToken });
    expect(found.status).toBe(200);
    expect(found.body.items.map((l: { title: string }) => l.title)).toEqual(['Hammer drill', 'Cordless drill']);
    const gifts = await api('GET', '/api/v1/requests/suggestions?kind=receive&q=drill', { token: ranaToken });
    expect(gifts.body.items.map((l: { title: string }) => l.title)).toEqual(['Drill bits']);
    expect((await api('GET', '/api/v1/requests/suggestions?kind=borrow&q=dr', { token: ranaToken })).body.items).toEqual([]);
  });

  it('suggests at most 5', async () => {
    const { ranaToken, samToken } = await people();
    for (let i = 0; i < 7; i++) await createOffering(samToken, { type: 'lend', title: `Ladder ${i}` });
    expect((await api('GET', '/api/v1/requests/suggestions?kind=borrow&q=ladder', { token: ranaToken })).body.items).toHaveLength(5);
  });
});

describe('answering with an offering (US3)', () => {
  it('links an offering made for the request, and says so on the offering', async () => {
    const { rana, ranaToken, samToken } = await people();
    await emailOn(rana.id, 'request');
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill for shelves' });
    const made = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'lend', title: 'My drill', forRequest: id } });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ linked: true, answersRequest: { requestId: id, title: 'Drill for shelves', asker: { displayName: 'Rana' } } });
    const request = await api('GET', `/api/v1/requests/${id}`, { token: ranaToken });
    expect(request.body.links).toEqual([
      expect.objectContaining({ offering: expect.objectContaining({ id: made.body.id, title: 'My drill', owner: expect.objectContaining({ displayName: 'Sam' }) }), available: true, canRemove: true }) // The asker can take it off (FR-017a).
    ]);
    expect(request.body.linkCount).toBe(1);
    expect(testOutbox.filter((e) => e.to === rana.email).map((e) => e.subject)).toEqual(['Sam can help with “Drill for shelves”']);
    // Find shows it too.
    const found = await api('GET', '/api/v1/offerings?q=drill', { token: ranaToken });
    expect(found.body.items[0].answersRequest).toMatchObject({ requestId: id });
    // A linked offering is an ordinary offering: anyone can still see and propose on it.
    expect((await api('GET', `/api/v1/offerings/${made.body.id}`, { token: ranaToken })).body.answers).toHaveLength(1);
  });

  it('keeps the offering when the request closed meanwhile, and says why it isn’t linked', async () => {
    const { ranaToken, samToken } = await people();
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill' });
    await api('POST', `/api/v1/requests/${id}/close`, { token: ranaToken });
    const made = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'lend', title: 'Drill', forRequest: id } });
    expect(made.status).toBe(201);
    expect(made.body).toMatchObject({ linked: false, linkProblem: 'request_closed' });
    expect((await api('GET', `/api/v1/offerings/${made.body.id}`, { token: samToken })).status).toBe(200);
  });

  it('links only the right offerings, by the right people', async () => {
    const { ranaToken, samToken, kimToken } = await people();
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill' });
    const samsDrill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const samsGift = await createOffering(samToken, { type: 'gift', title: 'Bits' });
    const kimsDrill = await createOffering(kimToken, { type: 'lend', title: 'Old drill' });
    const paused = await createOffering(samToken, { type: 'lend', title: 'Spare drill' });
    await api('POST', `/api/v1/offerings/${paused.id}/pause`, { token: samToken });
    const ranasDrill = await createOffering(ranaToken, { type: 'lend', title: 'My drill' });
    const link = (token: string, offeringId: string) => api('POST', `/api/v1/requests/${id}/links`, { token, body: { offeringId } });

    expect((await link(samToken, samsDrill.id)).status).toBe(201);
    expect((await link(samToken, samsDrill.id)).body.error.code).toBe('already_linked');
    expect((await link(samToken, samsGift.id)).body.error.code).toBe('wrong_type');
    expect((await link(samToken, paused.id)).body.error.code).toBe('not_available');
    expect((await link(samToken, kimsDrill.id)).status).toBe(403);
    expect((await link(ranaToken, ranasDrill.id)).status).toBe(403);
    // The asker may link an offering they found, so a proposal on it can close the request.
    expect((await link(ranaToken, kimsDrill.id)).status).toBe(201);

    const links = (await api('GET', `/api/v1/requests/${id}`, { token: kimToken })).body.links as { id: string; offering: { id: string }; canRemove: boolean }[];
    const kimsLink = links.find((l) => l.offering.id === kimsDrill.id)!;
    expect(kimsLink.canRemove).toBe(true); // Kim owns the offering.
    const samsLink = links.find((l) => l.offering.id === samsDrill.id)!;
    expect((await api('DELETE', `/api/v1/requests/${id}/links/${samsLink.id}`, { token: kimToken })).status).toBe(403);
    // The asker can take any offer off their request ("Not for my request"), even one a helper made.
    const asAsker = (await api('GET', `/api/v1/requests/${id}`, { token: ranaToken })).body.links as { id: string; canRemove: boolean }[];
    expect(asAsker.find((l) => l.id === samsLink.id)!.canRemove).toBe(true);
    expect((await api('DELETE', `/api/v1/requests/${id}/links/${samsLink.id}`, { token: ranaToken })).status).toBe(204);
    expect((await api('DELETE', `/api/v1/requests/${id}/links/${kimsLink.id}`, { token: ranaToken })).status).toBe(204);
    expect((await api('GET', `/api/v1/requests/${id}`, { token: ranaToken })).body.links).toEqual([]);
    // The offerings themselves are unchanged.
    expect((await api('GET', `/api/v1/offerings/${samsDrill.id}`, { token: samToken })).body.status).toBe('available');
  });

  it('offers the asker "Link to my request" on offerings of the matching kind', async () => {
    const { ranaToken, samToken } = await people();
    const borrow = await ask(ranaToken, { kind: 'borrow', title: 'Drill' });
    await ask(ranaToken, { kind: 'receive', title: 'Rice' });
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    const shown = await api('GET', `/api/v1/offerings/${drill.id}`, { token: ranaToken });
    expect(shown.body.myLinkableRequests).toEqual([{ id: borrow, title: 'Drill' }]);
    await api('POST', `/api/v1/requests/${borrow}/links`, { token: ranaToken, body: { offeringId: drill.id } });
    const after = await api('GET', `/api/v1/offerings/${drill.id}`, { token: ranaToken });
    expect(after.body.myLinkableRequests).toEqual([]);
    expect(after.body.myOpenRequestsLinked).toEqual([{ id: borrow, title: 'Drill' }]);
  });
});

describe('browsing requests (US5)', () => {
  it('lists open requests by others, newest first, with filters and paging', async () => {
    const { ranaToken, samToken, kimToken } = await people();
    const drill = await ask(ranaToken, { kind: 'borrow', title: 'Drill', area: riverside });
    const tuneUp = await ask(kimToken, { kind: 'service', title: 'Bike tune-up' });
    const sofa = await ask(kimToken, { kind: 'service', title: 'Help moving a sofa' });
    const closed = await ask(kimToken, { kind: 'borrow', title: 'Closed drill' });
    await api('POST', `/api/v1/requests/${closed}/close`, { token: kimToken });
    await ask(samToken, { kind: 'borrow', title: 'My own' });

    const all = await api('GET', '/api/v1/requests', { token: samToken });
    expect(all.body.items.map((r: { id: string }) => r.id)).toEqual([sofa, tuneUp, drill]);
    expect(all.body.items[2]).toMatchObject({ kind: 'borrow', area: { display: 'Riverside, Springfield' }, asker: { displayName: 'Rana' }, linkCount: 0 });
    const services = await api('GET', '/api/v1/requests?kind=service', { token: samToken });
    expect(services.body.items.map((r: { id: string }) => r.id)).toEqual([sofa, tuneUp]);
    expect((await api('GET', '/api/v1/requests?q=bike', { token: samToken })).body.items.map((r: { id: string }) => r.id)).toEqual([tuneUp]);
    expect((await api('GET', '/api/v1/requests?area=riverside', { token: samToken })).body.items.map((r: { id: string }) => r.id)).toEqual([drill]);
    const first = await api('GET', '/api/v1/requests?limit=2', { token: samToken });
    expect(first.body.items).toHaveLength(2);
    const next = await api('GET', `/api/v1/requests?limit=2&cursor=${first.body.nextCursor}`, { token: samToken });
    expect(next.body.items.map((r: { id: string }) => r.id)).toEqual([drill]);
    expect(next.body.nextCursor).toBeNull();
  });

  it('lists my own requests, open first, with counts of issues I haven’t seen', async () => {
    const { ranaToken, samToken } = await people();
    const older = await ask(ranaToken, { kind: 'borrow', title: 'Older' });
    const closed = await ask(ranaToken, { kind: 'borrow', title: 'Closed' });
    await api('POST', `/api/v1/requests/${closed}/close`, { token: ranaToken });
    await api('POST', `/api/v1/requests/${older}/flags`, { token: samToken, body: { request: 'Is this still needed?' } });
    const mine = await api('GET', '/api/v1/requests?mine=true', { token: ranaToken });
    expect(mine.body.items.map((r: { id: string; status: string }) => [r.id, r.status])).toEqual([
      [older, 'open'],
      [closed, 'closed']
    ]);
    expect(mine.body.items[0].unseenFlags).toBe(1);
    expect((await api('GET', '/api/v1/me/summary', { token: ranaToken })).body.unseenRequestFlags).toBe(1);
    await api('GET', `/api/v1/requests/${older}`, { token: ranaToken });
    expect((await api('GET', '/api/v1/me/summary', { token: ranaToken })).body.unseenRequestFlags).toBe(0);
  });
});

describe('flags on requests (US7)', () => {
  it('sends a written request to the asker without changing the request', async () => {
    const { rana, ranaToken, samToken } = await people();
    await emailOn(rana.id, 'flag');
    const id = await ask(ranaToken, { kind: 'borrow', title: 'Drill' });
    expect((await api('POST', `/api/v1/requests/${id}/flags`, { token: ranaToken, body: { request: 'Mine' } })).status).toBe(400);
    expect((await api('POST', `/api/v1/requests/${id}/flags`, { token: samToken, body: { request: '' } })).status).toBe(400);
    expect((await api('POST', `/api/v1/requests/${id}/flags`, { token: samToken, body: { request: 'Please add an area' } })).status).toBe(204);
    expect(testOutbox.filter((e) => e.to === rana.email).map((e) => e.subject)).toEqual(['Sam sent a request about your request']);
    const shown = await api('GET', `/api/v1/requests/${id}`, { token: ranaToken });
    expect(shown.body).toMatchObject({ status: 'open', flags: [expect.objectContaining({ request: 'Please add an area', from: expect.objectContaining({ displayName: 'Sam' }) })] });
    expect((await api('GET', `/api/v1/requests/${id}`, { token: samToken })).body.flags).toBeUndefined();
  });
});
