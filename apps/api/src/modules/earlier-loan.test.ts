// Spec Edge Case "Earlier loan not back in time": when a loan is past its end and not marked
// returned, the next loan's proposal and agreement say so calmly, to both members.
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { agreement } from '../db/schema/index.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createOffering, futureDate, propose, signIn } from '../test/setup.ts';

async function setUp() {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const kim = await createInvitedMember(sam, 'Kim');
  const [samToken, alexToken, kimToken] = await Promise.all([signIn(sam), signIn(alex), signIn(kim)]);
  const drill = await createOffering(samToken, { type: 'lend', title: 'Drill' });
  const first = await agree(samToken, alexToken, drill.id, completeDetails('lend', { date: futureDate(1) }));
  return { samToken, alexToken, kimToken, drill, first };
}

/** Moves the first loan into the past, so it's overdue. */
async function makeOverdue(agreementId: string) {
  const ended = new Date(Date.now() - 86_400_000);
  await db.update(agreement).set({ loanStartsAt: new Date(ended.getTime() - 2 * 86_400_000), loanEndsAt: ended }).where(eq(agreement.id, agreementId));
}

describe('an earlier loan not back in time', () => {
  it('shows on the next proposal and agreement, to both members', async () => {
    const { samToken, kimToken, drill, first } = await setUp();
    await makeOverdue(first.agreementId);
    const next = await propose(kimToken, drill.id, completeDetails('lend', { date: futureDate(10) }));
    for (const token of [samToken, kimToken]) {
      const shown = await api('GET', `/api/v1/proposals/${next.id}`, { token });
      expect(shown.body.earlierLoanNotBack).toMatchObject({ endsAt: expect.any(String) });
    }
    const accepted = await api('POST', `/api/v1/proposals/${next.id}/accept`, {
      token: samToken,
      body: { version: (await api('GET', `/api/v1/proposals/${next.id}`, { token: samToken })).body.version }
    });
    for (const token of [samToken, kimToken]) {
      const shown = await api('GET', `/api/v1/agreements/${accepted.body.agreementId}`, { token });
      expect(shown.body.earlierLoanNotBack).toMatchObject({ endsAt: expect.any(String) });
    }
  });

  it('says nothing once it is returned, or while it is not yet due', async () => {
    const { samToken, kimToken, drill, first } = await setUp();
    const next = await propose(kimToken, drill.id, completeDetails('lend', { date: futureDate(10) }));
    expect((await api('GET', `/api/v1/proposals/${next.id}`, { token: kimToken })).body.earlierLoanNotBack).toBeNull();
    await makeOverdue(first.agreementId);
    await api('POST', `/api/v1/agreements/${first.agreementId}/returned`, { token: samToken });
    expect((await api('GET', `/api/v1/proposals/${next.id}`, { token: kimToken })).body.earlierLoanNotBack).toBeNull();
    // The overdue loan itself isn't "an earlier loan" for its own page.
    expect((await api('GET', `/api/v1/agreements/${first.agreementId}`, { token: samToken })).body.earlierLoanNotBack).toBeNull();
  });
});
