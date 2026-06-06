// 003 US4: the asker's accepted proposal on a linked offering closes the request; nothing else does
// (FR-016 to FR-019, research §3).
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, completeDetails, createFounder, createInvitedMember, createOffering, futureDate, propose, signIn } from '../test/setup.ts';

async function setUp() {
  const rana = await createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const kim = await createInvitedMember(rana, 'Kim');
  const [ranaToken, samToken, kimToken] = await Promise.all([signIn(rana), signIn(sam), signIn(kim)]);
  const requestId = (await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: 'Drill' } })).body.id as string;
  const drill = await createOffering(samToken, { type: 'lend', title: 'Drill', forRequest: requestId });
  return { rana, sam, kim, ranaToken, samToken, kimToken, requestId, drill };
}

async function accept(listerToken: string, proposalId: string) {
  const shown = await api('GET', `/api/v1/proposals/${proposalId}`, { token: listerToken });
  return api('POST', `/api/v1/proposals/${proposalId}/accept`, { token: listerToken, body: { version: shown.body.version } });
}

const request = async (token: string, id: string) => (await api('GET', `/api/v1/requests/${id}`, { token })).body;

describe('closing a request with an agreement', () => {
  it("closes when the asker's proposal on a linked offering is accepted, and leaves the offering up", async () => {
    const { ranaToken, samToken, requestId, drill } = await setUp();
    const made = await propose(ranaToken, drill.id, completeDetails('lend'));
    expect((await api('GET', `/api/v1/proposals/${made.id}`, { token: ranaToken })).body.request).toEqual({ id: requestId, title: 'Drill', status: 'open' });
    const accepted = await accept(samToken, made.id);
    expect(accepted.status).toBe(200);
    expect(await request(ranaToken, requestId)).toMatchObject({ status: 'closed', closedReason: 'agreed', closedByAgreementId: accepted.body.agreementId });
    // Others see it settled, without the agreement.
    expect(await request(samToken, requestId)).toMatchObject({ status: 'closed', closedReason: 'agreed', closedByAgreementId: null });
    // The offering follows its own rules: a Lend offering stays up.
    expect((await api('GET', `/api/v1/offerings/${drill.id}`, { token: samToken })).body.status).toBe('available');
    // Closed requests aren't among open ones.
    expect((await api('GET', '/api/v1/requests', { token: samToken })).body.items.map((r: { id: string }) => r.id)).not.toContain(requestId);
    // It can be opened again.
    expect((await api('POST', `/api/v1/requests/${requestId}/reopen`, { token: ranaToken })).body).toMatchObject({ status: 'open', closedByAgreementId: null });
  });

  it("stays open for another member's accepted proposal, and for the asker's on an unlinked offering", async () => {
    const { ranaToken, samToken, kimToken, requestId, drill } = await setUp();
    const kims = await propose(kimToken, drill.id, completeDetails('lend', { date: futureDate(2) }));
    expect((await api('GET', `/api/v1/proposals/${kims.id}`, { token: kimToken })).body.request).toBeNull();
    expect((await accept(samToken, kims.id)).status).toBe(200);
    expect((await request(ranaToken, requestId)).status).toBe('open');

    const ladder = await createOffering(samToken, { type: 'lend', title: 'Ladder' });
    const ranas = await propose(ranaToken, ladder.id, completeDetails('lend'));
    expect((await accept(samToken, ranas.id)).status).toBe(200);
    expect((await request(ranaToken, requestId)).status).toBe('open');
  });

  it('asks which request when the offering is linked to several of the asker’s requests', async () => {
    const { ranaToken, samToken, requestId, drill } = await setUp();
    const second = (await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: 'Another drill' } })).body.id as string;
    await api('POST', `/api/v1/requests/${second}/links`, { token: samToken, body: { offeringId: drill.id } });
    const unsure = await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: ranaToken, body: completeDetails('lend') });
    expect(unsure.status).toBe(409);
    expect(unsure.body.error.code).toBe('choose_request');
    expect(unsure.body.error.requests.map((r: { id: string }) => r.id).sort()).toEqual([requestId, second].sort());
    const wrong = await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: ranaToken, body: { ...completeDetails('lend'), requestId: crypto.randomUUID() } });
    expect(wrong.status).toBe(400);
    const chosen = await api('POST', `/api/v1/offerings/${drill.id}/proposals`, { token: ranaToken, body: { ...completeDetails('lend'), requestId: second } });
    expect(chosen.status).toBe(201);
    await accept(samToken, chosen.body.id);
    expect((await request(ranaToken, second)).status).toBe('closed');
    expect((await request(ranaToken, requestId)).status).toBe('open');
  });

  it('a request closed by hand before acceptance stays closed by the asker', async () => {
    const { ranaToken, samToken, requestId, drill } = await setUp();
    const made = await propose(ranaToken, drill.id, completeDetails('lend'));
    await api('POST', `/api/v1/requests/${requestId}/close`, { token: ranaToken });
    expect((await accept(samToken, made.id)).status).toBe(200);
    expect(await request(ranaToken, requestId)).toMatchObject({ status: 'closed', closedReason: 'by_asker', closedByAgreementId: null });
  });

  it('tells other helpers it is settled, and shows the asker their other open proposals', async () => {
    const { kim, ranaToken, samToken, kimToken, requestId, drill } = await setUp();
    await db.insert(notificationPreference).values({ memberId: kim.id, type: 'request', email: true });
    const kimsDrill = await createOffering(kimToken, { type: 'lend', title: 'Kim’s drill', forRequest: requestId });
    const other = await propose(ranaToken, kimsDrill.id, completeDetails('lend'));
    const made = await propose(ranaToken, drill.id, completeDetails('lend'));
    await accept(samToken, made.id);
    expect(testOutbox.filter((e) => e.to === kim.email).map((e) => e.subject)).toEqual(["Rana's request “Drill” is settled"]);
    expect((await request(ranaToken, requestId)).myOtherOpenProposals).toEqual([{ id: other.id, offeringTitle: 'Kim’s drill' }]);
  });
});
