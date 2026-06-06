// Live messages in an open conversation (FR-018a; research §9).
import { describe, expect, it } from 'vitest';
import { app } from '../app.ts';
import { api, createFounder, createInvitedMember, createListing, propose, signIn } from '../test/setup.ts';
import { ready } from './live.ts';

/** Reads Server-Sent Events text until `until` matches or the time runs out. */
async function readStream(body: ReadableStream<Uint8Array>, until: (text: string) => boolean, ms: number) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  const deadline = Date.now() + ms;
  while (Date.now() < deadline && !until(text)) {
    const chunk = await Promise.race([reader.read(), new Promise<null>((resolve) => setTimeout(() => resolve(null), deadline - Date.now()))]);
    if (!chunk || chunk.done) break;
    text += decoder.decode(chunk.value);
  }
  await reader.cancel();
  return text;
}

describe('live stream', () => {
  it('delivers a new message to an open conversation within 2 seconds', async () => {
    const sam = await createFounder('Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const samToken = await signIn(sam);
    const alexToken = await signIn(alex);
    const drill = await createListing(samToken, { type: 'lend', title: 'Drill' });
    const conversation = { id: (await propose(alexToken, drill.id)).conversationId };

    const response = await app.request(`/api/v1/conversations/${conversation.id}/live`, { headers: { authorization: `Bearer ${samToken}` } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reading = readStream(response.body!, (text) => text.includes('event: message'), 2000);
    await new Promise((resolve) => setTimeout(resolve, 50)); // Let the stream subscribe.
    await ready(conversation.id);

    const started = Date.now();
    await api('POST', `/api/v1/conversations/${conversation.id}/messages`, { token: alexToken, body: { body: 'Hello there' } });
    const text = await reading;
    expect(Date.now() - started).toBeLessThan(2000);
    expect(text).toContain(': connected');
    const data = text.split('\n').find((line) => line.startsWith('data: '));
    expect(JSON.parse(data!.slice(6))).toMatchObject({ kind: 'text', body: 'Hello there', author: { displayName: 'Alex' } });
  });

  it('sends heartbeats to keep the connection open', async () => {
    const sam = await createFounder('Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const samToken = await signIn(sam);
    const conversation = { id: (await propose(await signIn(alex), (await createListing(await signIn(sam), { type: 'lend', title: 'Drill' })).id)).conversationId };
    const response = await app.request(`/api/v1/conversations/${conversation.id}/live`, { headers: { authorization: `Bearer ${samToken}` } });
    const text = await readStream(response.body!, (t) => t.includes(': heartbeat'), 2000);
    expect(text).toContain(': heartbeat');
  });

  it('refuses members who are not in the conversation', async () => {
    const sam = await createFounder('Sam');
    const alex = await createInvitedMember(sam, 'Alex');
    const robinToken = await signIn(await createInvitedMember(sam, 'Robin'));
    const conversation = { id: (await propose(await signIn(alex), (await createListing(await signIn(sam), { type: 'lend', title: 'Drill' })).id)).conversationId };
    const response = await app.request(`/api/v1/conversations/${conversation.id}/live`, { headers: { authorization: `Bearer ${robinToken}` } });
    expect(response.status).toBe(404);
  });
});
