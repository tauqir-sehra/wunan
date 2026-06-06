// Asking for help (US6; FR-027 to FR-029b).
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { member, notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { agree, api, completeDetails, createFounder, createInvitedMember, createListing, signIn, type TestMember } from '../test/setup.ts';

/**
 * Invite chain:  Fay (founder) → Ana → Ben → Xan (borrower)
 *                Fay → Olu (owner);  Gus is a second founder.
 */
async function chain() {
  const fay = await createFounder('Fay');
  const gus = await createFounder('Gus');
  const ana = await createInvitedMember(fay, 'Ana');
  const ben = await createInvitedMember(ana, 'Ben');
  const xan = await createInvitedMember(ben, 'Xan');
  const olu = await createInvitedMember(fay, 'Olu');
  return { fay, gus, ana, ben, xan, olu };
}

async function loanBetween(owner: TestMember, borrower: TestMember) {
  const token = await signIn(owner);
  const borrowerToken = await signIn(borrower);
  const drill = await createListing(token, { type: 'lend', title: 'Drill' });
  const deal = await agree(token, borrowerToken, drill.id, completeDetails('lend'));
  return { ...deal, ownerToken: token, borrowerToken };
}

const names = (people: { displayName: string }[]) => people.map((p) => p.displayName).sort();

describe('asking for help', () => {
  it("brings in the reported member's inviter, in a shared conversation, and tells them", async () => {
    const { ben, xan, olu } = await chain();
    await db.insert(notificationPreference).values({ memberId: ben.id, type: 'report', email: true });
    const { agreementId, ownerToken } = await loanBetween(olu, xan);
    const report = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'The drill has not come back.' } });
    expect(report.status).toBe(201);
    expect(report.body).toMatchObject({ escalationLevel: 'inviter', status: 'open', canEscalate: true });
    expect(names(report.body.mediators)).toEqual(['Ben']);
    expect(testOutbox.find((e) => e.to === ben.email)?.subject).toBe('Someone asked for help with an agreement');

    // Ben, the mediator, sees the conversation (marked as asking for help) and the agreement.
    const benToken = await signIn(ben);
    const messages = await api('GET', `/api/v1/conversations/${report.body.conversationId}/messages`, { token: benToken });
    expect(messages.body.conversation.isMediation).toBe(true);
    expect(names(messages.body.conversation.participants)).toEqual(['Olu', 'Xan']);
    expect(messages.body.items.map((m: { body: string }) => m.body)).toContain('The drill has not come back.');
    expect((await api('GET', `/api/v1/agreements/${agreementId}`, { token: benToken })).status).toBe(200);
  });

  it('only the two people in the agreement can ask, with a description', async () => {
    const { ana, xan, olu } = await chain();
    const { agreementId } = await loanBetween(olu, xan);
    const anaToken = await signIn(ana);
    expect((await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: anaToken, body: { description: 'Hmm' } })).status).toBe(404);
    const xanToken = await signIn(xan);
    expect((await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: xanToken, body: { description: '' } })).status).toBe(400);
    expect((await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: xanToken, body: { description: 'x'.repeat(2001) } })).status).toBe(400);
  });

  it('escalates up the chain once, then to all founders, then no further', async () => {
    const { xan, olu } = await chain();
    const { agreementId, ownerToken } = await loanBetween(olu, xan);
    const { body: report } = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back.' } });
    const escalate = () => api('POST', `/api/v1/reports/${report.id}/escalate`, { token: ownerToken });

    const first = await escalate();
    expect(first.body.escalationLevel).toBe('inviters_inviter');
    expect(names(first.body.mediators)).toEqual(['Ana', 'Ben']);

    const second = await escalate();
    expect(second.body).toMatchObject({ escalationLevel: 'founders', canEscalate: false });
    expect(names(second.body.mediators)).toEqual(['Ana', 'Ben', 'Fay', 'Gus']);

    const third = await escalate();
    expect(third.status).toBe(409);
    expect(third.body.error.code).toBe('already_at_founders');
  });

  it("goes straight to the founders when the inviter's inviter is a founder", async () => {
    const { ana, olu } = await chain();
    const { agreementId, ownerToken } = await loanBetween(olu, ana); // Ana was invited by Fay (a founder).
    const { body: report } = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back.' } });
    expect(names(report.mediators)).toEqual(['Fay']);
    const escalated = await api('POST', `/api/v1/reports/${report.id}/escalate`, { token: ownerToken });
    expect(escalated.body.escalationLevel).toBe('founders');
    expect(names(escalated.body.mediators)).toEqual(['Fay', 'Gus']);
  });

  it('skips inviters who are no longer members, and people already in the agreement', async () => {
    const { ana, ben, xan, olu } = await chain();
    await db.update(member).set({ deletedAt: new Date() }).where(eq(member.id, ben.id));
    const { agreementId, ownerToken } = await loanBetween(olu, xan);
    const { body: report } = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back.' } });
    expect(names(report.mediators)).toEqual(['Ana']);

    // When the reported member's inviter is the reporter, the next person up helps instead.
    const fromAna = await loanBetween(ana, await createInvitedMember(ana, 'Zed'));
    const { body: own } = await api('POST', `/api/v1/agreements/${fromAna.agreementId}/reports`, { token: fromAna.ownerToken, body: { description: 'Not back.' } });
    expect(names(own.mediators)).toEqual(['Fay']);
  });

  it('can be settled with a note by the reporter or a helper, and can also stay open', async () => {
    const { ben, xan, olu } = await chain();
    const { agreementId, ownerToken } = await loanBetween(olu, xan);
    const { body: report } = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back.' } });
    const xanToken = await signIn(xan);
    expect((await api('POST', `/api/v1/reports/${report.id}/resolve`, { token: xanToken, body: { outcomeNote: 'Fine' } })).status).toBe(403);
    const benToken = await signIn(ben);
    expect((await api('POST', `/api/v1/reports/${report.id}/resolve`, { token: benToken, body: { outcomeNote: '' } })).status).toBe(400);
    expect((await api('POST', `/api/v1/reports/${report.id}/resolve`, { token: benToken, body: { outcomeNote: 'x'.repeat(1001) } })).status).toBe(400);
    const settled = await api('POST', `/api/v1/reports/${report.id}/resolve`, { token: benToken, body: { outcomeNote: 'Returned on Sunday.' } });
    expect(settled.body).toMatchObject({ status: 'resolved', outcomeNote: 'Returned on Sunday.', canEscalate: false });
    const agreement = await api('GET', `/api/v1/agreements/${agreementId}`, { token: ownerToken });
    expect(agreement.body.reports).toEqual([{ id: report.id, status: 'resolved', outcomeNote: 'Returned on Sunday.' }]);
  });

  it("never changes the reported member's access", async () => {
    const { fay, xan, olu } = await chain();
    const { agreementId, ownerToken } = await loanBetween(olu, xan);
    const { body: report } = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back.' } });
    await api('POST', `/api/v1/reports/${report.id}/escalate`, { token: ownerToken });
    await api('POST', `/api/v1/reports/${report.id}/escalate`, { token: ownerToken });

    const xanToken = await signIn(xan);
    expect((await api('GET', '/api/v1/me', { token: xanToken })).status).toBe(200);
    expect((await api('POST', '/api/v1/listings', { token: xanToken, body: { type: 'gift', title: 'Apples' } })).status).toBe(201);
    expect((await api('GET', `/api/v1/members/${xan.id}`, { token: await signIn(fay) })).status).toBe(200);
    expect((await api('GET', `/api/v1/reports/${report.id}`, { token: xanToken })).status).toBe(200);
  });

  it('keeps reports private to the people involved', async () => {
    const { ana, xan, olu } = await chain();
    const { agreementId, ownerToken } = await loanBetween(olu, xan);
    const { body: report } = await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back.' } });
    expect((await api('GET', `/api/v1/reports/${report.id}`, { token: await signIn(ana) })).status).toBe(404);
  });

  it("lets helpers read the proposal's messages only once a party shares them", async () => {
    const { ben, xan, olu } = await chain();
    const { agreementId, ownerToken, borrowerToken, conversationId } = await loanBetween(olu, xan);
    await api('POST', `/api/v1/conversations/${conversationId}/messages`, { token: borrowerToken, body: { body: "I'll bring it back Friday." } });
    const report = (await api('POST', `/api/v1/agreements/${agreementId}/reports`, { token: ownerToken, body: { description: 'Not back yet.' } })).body;
    expect(report).toMatchObject({ proposalMessagesShared: false, proposalConversationId: null, canShareProposalMessages: true });

    const benToken = await signIn(ben);
    expect((await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: benToken })).status).toBe(404);
    expect((await api('POST', `/api/v1/reports/${report.id}/share-proposal-messages`, { token: benToken })).status).toBe(403);

    const shared = await api('POST', `/api/v1/reports/${report.id}/share-proposal-messages`, { token: borrowerToken });
    expect(shared.body).toMatchObject({ proposalMessagesShared: true, proposalConversationId: conversationId });
    const read = await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: benToken });
    expect(read.status).toBe(200);
    expect(read.body.conversation.canWrite).toBe(false);
    expect(read.body.items.map((m: { body: string }) => m.body)).toContain("I'll bring it back Friday.");
    expect((await api('POST', `/api/v1/conversations/${conversationId}/messages`, { token: benToken, body: { body: 'Hi' } })).status).toBe(403);
    expect((await api('POST', `/api/v1/reports/${report.id}/share-proposal-messages`, { token: ownerToken })).body.error.code).toBe('already_shared');
    const thread = await api('GET', `/api/v1/conversations/${report.conversationId}/messages`, { token: benToken });
    expect(thread.body.items[0]).toMatchObject({ kind: 'messages_shared' });
  });
});
