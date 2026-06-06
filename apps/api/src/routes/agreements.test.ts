// Agreements made from accepted proposals (001 FR-025, FR-026; 002 FR-018 to FR-021): history,
// privacy, marking loans returned, and what needs attention. Making them is tested in proposals.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { agreement } from '../db/schema/index.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createListing, signIn } from '../test/setup.ts';

async function setup() {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const samToken = await signIn(sam);
  const alexToken = await signIn(alex);
  return { sam, alex, samToken, alexToken };
}

describe('agreements', () => {
  it('copies what was agreed, and only the owner marks a loan returned', async () => {
    const { samToken, alexToken } = await setup();
    const drill = await createListing(samToken, { type: 'lend', title: 'Drill', loanLength: 3, loanLengthUnit: 'days' });
    const { agreementId, proposalId } = await agree(samToken, alexToken, drill.id, completeDetails('lend'));

    const shown = await api('GET', `/api/v1/agreements/${agreementId}`, { token: alexToken });
    expect(shown.body).toMatchObject({ outcome: 'lent', group: 'borrowed', proposalId, handover: 'online', returnedAt: null, overdue: false });
    expect(new Date(shown.body.loanEndsAt).getTime() - new Date(shown.body.loanStartsAt).getTime()).toBe(2 * 86_400_000);

    expect((await api('POST', `/api/v1/agreements/${agreementId}/returned`, { token: alexToken })).status).toBe(403);
    const returned = await api('POST', `/api/v1/agreements/${agreementId}/returned`, { token: samToken });
    expect(returned.body.returnedAt).not.toBeNull();
    expect((await api('POST', `/api/v1/agreements/${agreementId}/returned`, { token: samToken })).status).toBe(409);
  });

  it('only loans can be marked returned', async () => {
    const { samToken, alexToken } = await setup();
    const rice = await createListing(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const { agreementId } = await agree(samToken, alexToken, rice.id, completeDetails('gift', { amount: '1' }));
    expect((await api('POST', `/api/v1/agreements/${agreementId}/returned`, { token: samToken })).body.error.code).toBe('not_a_loan');
  });

  it("groups history from each person's side and counts overdue loans", async () => {
    const { samToken, alexToken } = await setup();
    const rice = await createListing(samToken, { type: 'gift', title: 'Rice', amount: '5', unit: 'kg' });
    const drill = await createListing(samToken, { type: 'lend', title: 'Drill' });
    await agree(samToken, alexToken, rice.id, completeDetails('gift', { amount: '1' }));
    const loan = await agree(samToken, alexToken, drill.id, completeDetails('lend'));
    // The loan ended yesterday and hasn't been marked returned.
    const day = 86_400_000;
    await db
      .update(agreement)
      .set({ loanStartsAt: new Date(Date.now() - 3 * day), loanEndsAt: new Date(Date.now() - day) })
      .where(eq(agreement.id, loan.agreementId));

    const groups = async (token: string) =>
      (await api('GET', '/api/v1/me/agreements', { token })).body.items.map((a: { group: string }) => a.group).sort();
    expect(await groups(samToken)).toEqual(['given', 'lent']);
    expect(await groups(alexToken)).toEqual(['borrowed', 'received']);
    const borrowed = (await api('GET', '/api/v1/me/agreements', { token: alexToken })).body.items.find((a: { group: string }) => a.group === 'borrowed');
    expect(borrowed.overdue).toBe(true);
    expect((await api('GET', '/api/v1/me/summary', { token: alexToken })).body.agreementsNeedingAttention).toBe(1);
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.agreementsNeedingAttention).toBe(1);
  });

  it('keeps agreements private to the two people', async () => {
    const { sam, samToken, alexToken } = await setup();
    const kim = await createInvitedMember(sam, 'Kim');
    const rice = await createListing(samToken, { type: 'gift', title: 'Rice' });
    const { agreementId } = await agree(samToken, alexToken, rice.id, completeDetails('gift'));
    expect((await api('GET', `/api/v1/agreements/${agreementId}`, { token: await signIn(kim) })).status).toBe(404);
  });

  it('the old recording and confirming endpoints are gone', async () => {
    const { samToken } = await setup();
    const rice = await createListing(samToken, { type: 'gift', title: 'Rice' });
    expect((await api('POST', `/api/v1/listings/${rice.id}/agreements`, { token: samToken, body: {} })).status).toBe(404);
  });
});
