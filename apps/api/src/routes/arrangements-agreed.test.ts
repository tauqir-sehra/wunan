// Agreements made from accepted proposals (001 FR-025, FR-026; 002 FR-018 to FR-021): history,
// privacy, marking loans returned, and what needs attention. Making them is tested in proposals.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { arrangement } from '../db/schema/index.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createOffering, signIn } from '../test/setup.ts';

async function setup() {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const samToken = await signIn(sam);
  const alexToken = await signIn(alex);
  return { sam, alex, samToken, alexToken };
}

describe('agreed arrangements', () => {
  it('keeps what was agreed on the same arrangement, and only the owner marks a loan returned', async () => {
    const { samToken, alexToken } = await setup();
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill', loanLength: 3, loanLengthUnit: 'days' });
    const { arrangementId } = await agree(samToken, alexToken, drill.id, completeDetails('lend'));

    const shown = await api('GET', `/api/v1/arrangements/${arrangementId}`, { token: alexToken });
    expect(shown.body).toMatchObject({
      id: arrangementId,
      status: 'agreed',
      stage: 'agreed',
      myRole: 'requester',
      details: { handover: 'online' },
      agreed: { returnedAt: null, overdue: false, doneAt: null }
    });
    expect(new Date(shown.body.agreed.loanEndsAt).getTime() - new Date(shown.body.agreed.loanStartsAt).getTime()).toBe(2 * 86_400_000);
    // Once agreed, the details are fixed.
    expect((await api('PATCH', `/api/v1/arrangements/${arrangementId}`, { token: alexToken, body: { handover: 'at_lister' } })).body.error.code).toBe('arrangement_ended');

    expect((await api('POST', `/api/v1/arrangements/${arrangementId}/returned`, { token: alexToken })).status).toBe(403);
    const returned = await api('POST', `/api/v1/arrangements/${arrangementId}/returned`, { token: samToken });
    expect(returned.body.agreed.returnedAt).not.toBeNull();
    expect(returned.body.stage).toBe('returned');
    expect(returned.body.timeline.map((s: { step: string }) => s.step)).toContain('returned');
    expect((await api('POST', `/api/v1/arrangements/${arrangementId}/returned`, { token: samToken })).status).toBe(409);
  });

  it('only loans can be marked returned', async () => {
    const { samToken, alexToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const { arrangementId } = await agree(samToken, alexToken, rice.id, completeDetails('gift', { amount: '1' }));
    expect((await api('POST', `/api/v1/arrangements/${arrangementId}/returned`, { token: samToken })).body.error.code).toBe('not_a_loan');
  });

  it('puts a loan past its due date under "Waiting on you" for its owner only', async () => {
    const { samToken, alexToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
    await agree(samToken, alexToken, rice.id, completeDetails('gift', { amount: '1' }));
    const loan = await agree(samToken, alexToken, drill.id, completeDetails('lend'));
    // The loan ended yesterday and hasn't been marked returned.
    const day = 86_400_000;
    await db
      .update(arrangement)
      .set({ loanStartsAt: new Date(Date.now() - 3 * day), loanEndsAt: new Date(Date.now() - day) })
      .where(eq(arrangement.id, loan.arrangementId));

    const titles = (items: { offering: { title: string } }[]) => items.map((a) => a.offering.title).sort();
    const sams = (await api('GET', '/api/v1/arrangements', { token: samToken })).body;
    expect(titles(sams.needsYou)).toEqual(['Drill']);
    expect(titles(sams.inProgress)).toEqual(['Rice']);
    expect(sams.needsYou[0]).toMatchObject({ stage: 'on_loan', overdue: true, needsMe: true, myRole: 'lister' });
    const alexes = (await api('GET', '/api/v1/arrangements', { token: alexToken })).body;
    expect(alexes.needsYou).toEqual([]);
    expect(titles(alexes.inProgress)).toEqual(['Drill', 'Rice']);
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.arrangementsNeedingYou).toBe(1);
    expect((await api('GET', '/api/v1/me/summary', { token: alexToken })).body.arrangementsNeedingYou).toBe(0);
  });

  it('keeps arrangements private to the two people', async () => {
    const { sam, samToken, alexToken } = await setup();
    const kim = await createInvitedMember(sam, 'Kim');
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    const { arrangementId } = await agree(samToken, alexToken, rice.id, completeDetails('gift'));
    expect((await api('GET', `/api/v1/arrangements/${arrangementId}`, { token: await signIn(kim) })).status).toBe(404);
  });

  it('the old recording and confirming endpoints are gone', async () => {
    const { samToken } = await setup();
    const rice = await createOffering(samToken, { type: 'gift', title: 'Rice' });
    expect((await api('POST', `/api/v1/offerings/${rice.id}/agreements`, { token: samToken, body: {} })).status).toBe(404);
  });
});
