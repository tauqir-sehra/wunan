// 003 US6: public threads on requests and offerings (FR-023 to FR-023g).
import { describe, expect, it } from 'vitest';
import { app } from '../app.ts';
import { db } from '../db/index.ts';
import { notificationPreference } from '../db/schema/index.ts';
import { ready } from '../modules/live.ts';
import { testOutbox } from '../notify/email.ts';
import { api, createFounder, createInvitedMember, createOffering, signIn } from '../test/setup.ts';

async function setUp() {
  const rana = await createFounder('Rana');
  const sam = await createInvitedMember(rana, 'Sam');
  const kim = await createInvitedMember(rana, 'Kim');
  const [ranaToken, samToken, kimToken] = await Promise.all([signIn(rana), signIn(sam), signIn(kim)]);
  const requestId = (await api('POST', '/api/v1/requests', { token: ranaToken, body: { kind: 'borrow', title: 'Drill' } })).body.id as string;
  const offering = await createOffering(samToken, { type: 'lend', title: 'Cordless drill' });
  return { rana, sam, kim, ranaToken, samToken, kimToken, requestId, offering };
}

const post = (token: string, path: string, body: string) => api('POST', `/api/v1/${path}/messages`, { token, body: { body } });

describe('public threads', () => {
  it('lets any member read and post on a request and on an offering', async () => {
    const { ranaToken, samToken, kimToken, requestId, offering } = await setUp();
    expect((await post(samToken, `requests/${requestId}`, 'Brick or plaster?')).status).toBe(201);
    expect((await post(ranaToken, `requests/${requestId}`, 'Plaster.')).status).toBe(201);
    expect((await post(kimToken, `offerings/${offering.id}`, 'Does it come with a charger?')).status).toBe(201);

    const onRequest = await api('GET', `/api/v1/requests/${requestId}/messages`, { token: kimToken });
    expect(onRequest.body).toMatchObject({ hasEarlier: false, canPost: true });
    expect(onRequest.body.items.map((m: { body: string; author: { displayName: string } }) => [m.author.displayName, m.body])).toEqual([
      ['Sam', 'Brick or plaster?'],
      ['Rana', 'Plaster.']
    ]);
    const onOffering = await api('GET', `/api/v1/offerings/${offering.id}/messages`, { token: ranaToken });
    expect(onOffering.body.items).toHaveLength(1);
  });

  it('keeps messages to 240 characters of plain text', async () => {
    const { samToken, requestId } = await setUp();
    const long = await post(samToken, `requests/${requestId}`, 'x'.repeat(241));
    expect(long.status).toBe(400);
    expect(long.body.error.fields.body).toBe('Please keep it to 240 characters; this is 241.');
    expect((await post(samToken, `requests/${requestId}`, '   ')).status).toBe(400);
    expect((await post(samToken, `requests/${requestId}`, `  ${'y'.repeat(240)}  `)).status).toBe(201);
  });

  it('stays readable but takes no new messages once closed', async () => {
    const { ranaToken, samToken, requestId, offering } = await setUp();
    await post(samToken, `requests/${requestId}`, 'Hello');
    await api('POST', `/api/v1/requests/${requestId}/close`, { token: ranaToken });
    const refused = await post(samToken, `requests/${requestId}`, 'Still there?');
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('thread_closed');
    const thread = await api('GET', `/api/v1/requests/${requestId}/messages`, { token: samToken });
    expect(thread.body).toMatchObject({ canPost: false, items: [expect.objectContaining({ body: 'Hello' })] });
    await api('POST', `/api/v1/offerings/${offering.id}/remove`, { token: samToken });
    expect((await post(ranaToken, `offerings/${offering.id}`, 'Hi')).body.error.code).toBe('thread_closed');
  });

  it('shows the newest 20, oldest first, with earlier ones on request', async () => {
    const { samToken, requestId } = await setUp();
    for (let i = 1; i <= 23; i++) await post(samToken, `requests/${requestId}`, `Message ${i}`);
    const latest = await api('GET', `/api/v1/requests/${requestId}/messages`, { token: samToken });
    expect(latest.body.items).toHaveLength(20);
    expect(latest.body.items[0].body).toBe('Message 4');
    expect(latest.body.items.at(-1).body).toBe('Message 23');
    expect(latest.body.hasEarlier).toBe(true);
    const earlier = await api('GET', `/api/v1/requests/${requestId}/messages?before=${latest.body.items[0].id}`, { token: samToken });
    expect(earlier.body.items.map((m: { body: string }) => m.body)).toEqual(['Message 1', 'Message 2', 'Message 3']);
    expect(earlier.body.hasEarlier).toBe(false);
  });

  it('lets only the author remove a message, which then shows as removed', async () => {
    const { ranaToken, samToken, requestId } = await setUp();
    const { id } = (await post(samToken, `requests/${requestId}`, 'Oops, my number is 555')).body;
    expect((await api('DELETE', `/api/v1/public-messages/${id}`, { token: ranaToken })).status).toBe(403);
    expect((await api('DELETE', `/api/v1/public-messages/${id}`, { token: samToken })).status).toBe(204);
    const thread = await api('GET', `/api/v1/requests/${requestId}/messages`, { token: ranaToken });
    expect(thread.body.items[0]).toMatchObject({ id, body: '', removed: true });
  });

  it('notifies the asker or lister and earlier posters, at most once a day per thread', async () => {
    const { rana, sam, kim, ranaToken, samToken, kimToken, requestId } = await setUp();
    for (const m of [rana, sam, kim]) await db.insert(notificationPreference).values({ memberId: m.id, type: 'public_message', email: true });
    await post(samToken, `requests/${requestId}`, 'First');
    await post(kimToken, `requests/${requestId}`, 'Second');
    await post(ranaToken, `requests/${requestId}`, 'Third');
    const subjects = (email: string) => testOutbox.filter((e) => e.to === email).map((e) => e.subject);
    expect(subjects(rana.email)).toEqual(['New public message on “Drill”']); // Once today, however many.
    expect(subjects(sam.email)).toEqual(['New public message on “Drill”']);
    expect(subjects(kim.email)).toEqual(['New public message on “Drill”']);
  });

  it('shares the message limit as a safety backstop', async () => {
    const { samToken, requestId } = await setUp();
    for (let i = 0; i < 60; i++) await post(samToken, `requests/${requestId}`, `m${i}`);
    const over = await post(samToken, `requests/${requestId}`, 'one more');
    expect(over.status).toBe(429);
  });

  it('sends new messages and removals to open pages live', async () => {
    const { ranaToken, samToken, requestId } = await setUp();
    const response = await app.request(`/api/v1/requests/${requestId}/messages/live`, { headers: { authorization: `Bearer ${ranaToken}` } });
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await ready(requestId, 'public');
    const { id } = (await post(samToken, `requests/${requestId}`, 'Live hello')).body;
    await api('DELETE', `/api/v1/public-messages/${id}`, { token: samToken });
    let text = '';
    const deadline = Date.now() + 2000;
    while (Date.now() < deadline && (text.match(/event: message/g) ?? []).length < 2) {
      const chunk = await Promise.race([reader.read(), new Promise<null>((r) => setTimeout(() => r(null), deadline - Date.now()))]);
      if (!chunk || chunk.done) break;
      text += decoder.decode(chunk.value);
    }
    await reader.cancel();
    const events = text
      .split('\n')
      .filter((line) => line.startsWith('data: '))
      .map((line) => JSON.parse(line.slice(6)));
    expect(events.map((e) => e.removed)).toEqual([false, true]);
    expect(events[0]).toMatchObject({ body: 'Live hello', author: { displayName: 'Sam' } });
  });

  it('sends a written request to the author without changing the message', async () => {
    const { sam, ranaToken, samToken, requestId } = await setUp();
    await db.insert(notificationPreference).values({ memberId: sam.id, type: 'flag', email: true });
    const { id } = (await post(samToken, `requests/${requestId}`, 'Call me on 555 0100')).body;
    expect((await api('POST', `/api/v1/public-messages/${id}/flags`, { token: samToken, body: { request: 'x' } })).status).toBe(400);
    expect((await api('POST', `/api/v1/public-messages/${id}/flags`, { token: ranaToken, body: { request: 'Please remove your number' } })).status).toBe(204);
    expect(testOutbox.filter((e) => e.to === sam.email).map((e) => e.subject)).toEqual(['Rana sent a request about your message']);
    const asSam = await api('GET', `/api/v1/requests/${requestId}/messages`, { token: samToken });
    expect(asSam.body.items[0]).toMatchObject({ body: 'Call me on 555 0100', flags: [expect.objectContaining({ request: 'Please remove your number' })] });
    const asRana = await api('GET', `/api/v1/requests/${requestId}/messages`, { token: ranaToken });
    expect(asRana.body.items[0].flags).toBeUndefined();
  });
});
