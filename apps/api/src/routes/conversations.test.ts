// Threads: the messages of a proposal (001 FR-018 to FR-020; 002 FR-022 to FR-025).
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, propose, signIn } from '../test/setup.ts';

async function pair() {
  const sam = await createFounder('Sam');
  const alex = await createInvitedMember(sam, 'Alex');
  const samToken = await signIn(sam);
  const alexToken = await signIn(alex);
  const { body: drill } = await api('POST', '/api/v1/offerings', { token: samToken, body: { type: 'lend', title: 'Drill' } });
  const started = await propose(alexToken, drill.id);
  return { sam, alex, samToken, alexToken, drill, proposalId: started.id, conversationId: started.conversationId };
}

const send = (token: string, id: string, body: string) => api('POST', `/api/v1/conversations/${id}/messages`, { token, body: { body } });

describe('conversations', () => {
  it('has no inbox and no way to start a thread directly', async () => {
    const { sam, alexToken } = await pair();
    expect((await api('GET', '/api/v1/conversations', { token: alexToken })).status).toBe(404);
    expect((await api('POST', '/api/v1/conversations', { token: alexToken, body: { memberId: sam.id } })).status).toBe(404);
  });

  it('lets only participants read or send', async () => {
    const { sam, conversationId } = await pair();
    const outsider = await signIn(await createInvitedMember(sam, 'Robin'));
    expect((await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: outsider })).status).toBe(404);
    expect((await send(outsider, conversationId, 'Hello')).status).toBe(404);
  });

  it('limits messages to 4000 characters and needs some text', async () => {
    const { alexToken, conversationId } = await pair();
    expect((await send(alexToken, conversationId, 'x'.repeat(4001))).status).toBe(400);
    expect((await send(alexToken, conversationId, '   ')).body.error.fields.body).toBe('Please write a message.');
  });

  it('shows unread proposals until they are read', async () => {
    const { samToken, alexToken, conversationId } = await pair();
    await send(alexToken, conversationId, 'Is Saturday okay?');
    const list = await api('GET', '/api/v1/proposals', { token: samToken });
    expect(list.body.items[0]).toMatchObject({ unread: true, offering: { title: 'Drill' }, lastMessagePreview: 'Is Saturday okay?' });
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.proposalsWithNews).toBe(1);
    const page = await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: samToken });
    expect(page.body.conversation).toMatchObject({ offering: { title: 'Drill' }, canWrite: true });

    await api('POST', `/api/v1/conversations/${conversationId}/read`, { token: samToken });
    expect((await api('GET', '/api/v1/proposals', { token: samToken })).body.items[0].unread).toBe(false);
    expect((await api('GET', '/api/v1/me/summary', { token: samToken })).body.proposalsWithNews).toBe(0);
    // My own messages never count as unread for me.
    expect((await api('GET', '/api/v1/me/summary', { token: alexToken })).body.proposalsWithNews).toBe(0);
  });

  it('lists messages newest first', async () => {
    const { samToken, alexToken, conversationId } = await pair();
    await send(alexToken, conversationId, 'First');
    await send(samToken, conversationId, 'Second');
    const { body } = await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: samToken });
    expect(body.items.map((m: { body: string }) => m.body)).toEqual(['Second', 'First']);
    expect(body.items[0].author.displayName).toBe('Sam');
  });

  it('notifies the other participant by email when they turned it on, once an hour at most', async () => {
    const { sam, alexToken, conversationId } = await pair();
    await db.insert(notificationPreference).values({ memberId: sam.id, type: 'message', email: true });
    await send(alexToken, conversationId, 'Is Saturday okay?');
    await send(alexToken, conversationId, 'Or Sunday?');
    const toSam = testOutbox.filter((e) => e.to === sam.email);
    expect(toSam).toHaveLength(1);
    expect(toSam[0]).toMatchObject({ subject: 'New message from Alex about Drill' });
    expect(toSam[0]!.text).toContain('Is Saturday okay?');
  });

  it('rate-limits sending', async () => {
    const { alexToken, conversationId } = await pair();
    for (let i = 0; i < 60; i += 1) expect((await send(alexToken, conversationId, `Message ${i}`)).status).toBe(201);
    expect((await send(alexToken, conversationId, 'One more')).status).toBe(429);
  });
});

describe('contact sharing', () => {
  it('posts exactly the chosen details and nothing else', async () => {
    const { samToken, alexToken, conversationId } = await pair();
    await api('PUT', '/api/v1/me/contact', { token: alexToken, body: { sharePhone: '07700 900123', shareEmail: 'alex.home@example.org' } });
    const shared = await api('POST', `/api/v1/conversations/${conversationId}/contact-share`, { token: alexToken, body: { phone: true, email: false } });
    expect(shared.status).toBe(201);
    expect(shared.body).toMatchObject({ kind: 'contact_shared', body: 'Phone: 07700 900123' });
    const seen = await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: samToken });
    expect(JSON.stringify(seen.body)).not.toContain('alex.home');
  });

  it('needs something chosen and saved', async () => {
    const { alexToken, conversationId } = await pair();
    const url = `/api/v1/conversations/${conversationId}/contact-share`;
    expect((await api('POST', url, { token: alexToken, body: { phone: false, email: false } })).status).toBe(400);
    const notSaved = await api('POST', url, { token: alexToken, body: { phone: true } });
    expect(notSaved.body.error.message).toBe("You haven't saved a phone number yet. Add it in Settings first.");
  });
});

describe('call times', () => {
  it('can be accepted only by the other participant, once', async () => {
    const { samToken, alexToken, conversationId } = await pair();
    const time = new Date(Date.now() + 86_400_000).toISOString();
    const { body: proposal } = await api('POST', `/api/v1/conversations/${conversationId}/calls`, { token: alexToken, body: { proposedTime: time } });
    expect(proposal).toMatchObject({ kind: 'call_proposed', accepted: false });
    const accept = (token: string) => api('POST', `/api/v1/conversations/${conversationId}/calls/${proposal.id}/accept`, { token });

    expect((await accept(alexToken)).status).toBe(400);
    const accepted = await accept(samToken);
    expect(accepted.body).toMatchObject({ kind: 'call_accepted', proposedTime: proposal.proposedTime });
    expect((await accept(samToken)).status).toBe(409);
    const { body } = await api('GET', `/api/v1/conversations/${conversationId}/messages`, { token: samToken });
    expect(body.items.find((m: { id: string }) => m.id === proposal.id).accepted).toBe(true);
  });

  it('must be in the future', async () => {
    const { alexToken, conversationId } = await pair();
    const past = await api('POST', `/api/v1/conversations/${conversationId}/calls`, { token: alexToken, body: { proposedTime: '2020-01-01T10:00:00Z' } });
    expect(past.status).toBe(400);
  });
});
