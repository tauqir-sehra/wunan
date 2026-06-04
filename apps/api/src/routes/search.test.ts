// Finding listings (US3; FR-015 to FR-017).
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { db } from '../db/index.ts';
import { listing } from '../db/schema/index.ts';
import { api, createFounder, signIn } from '../test/setup.ts';

async function setup() {
  const token = await signIn(await createFounder());
  const make = async (body: Record<string, unknown>) => (await api('POST', '/api/v1/listings', { token, body })).body;
  return { token, make };
}
const search = (token: string, query: string) => api('GET', `/api/v1/listings?${query}`, { token });
const titles = (result: { body: { items: { title: string }[] } }) => result.body.items.map((item) => item.title);

describe('search', () => {
  it('matches word forms', async () => {
    const { token, make } = await setup();
    await make({ type: 'gift', title: 'Rice', area: 'Riverside' });
    await make({ type: 'lend', title: 'Drill' });
    expect(titles(await search(token, 'q=rices'))).toEqual(['Rice']);
    expect(titles(await search(token, 'q=drilling'))).toEqual(['Drill']);
  });

  it('also searches the description and what a trade wants', async () => {
    const { token, make } = await setup();
    await make({ type: 'trade', title: 'Sneakers', wanted: 'leather boots' });
    await make({ type: 'gift', title: 'Jar', description: 'Good for storing flour' });
    expect(titles(await search(token, 'q=boots'))).toEqual(['Sneakers']);
    expect(titles(await search(token, 'q=flour'))).toEqual(['Jar']);
  });

  it('combines type and area filters (area ignores case and matches part of it)', async () => {
    const { token, make } = await setup();
    await make({ type: 'gift', title: 'Rice', area: 'Riverside' });
    await make({ type: 'gift', title: 'Apples', area: 'Hillside' });
    await make({ type: 'lend', title: 'Ladder', area: 'Riverside' });
    expect(titles(await search(token, 'type=gift&area=river'))).toEqual(['Rice']);
    expect(titles(await search(token, 'type=trade'))).toEqual([]);
  });

  it('shows only available listings unless lent-out ones are asked for', async () => {
    const { token, make } = await setup();
    const available = await make({ type: 'gift', title: 'Available rice' });
    const paused = await make({ type: 'gift', title: 'Paused rice' });
    const closed = await make({ type: 'gift', title: 'Closed rice' });
    const lent = await make({ type: 'lend', title: 'Lent drill' });
    await api('POST', `/api/v1/listings/${paused.id}/pause`, { token });
    await api('POST', `/api/v1/listings/${closed.id}/remove`, { token });
    await db.update(listing).set({ status: 'lent_out' }).where(eq(listing.id, lent.id));
    expect(titles(await search(token, ''))).toEqual([available.title]);
    expect(titles(await search(token, 'includeLent=true')).sort()).toEqual(['Available rice', 'Lent drill']);
  });

  it('shows the newest first, a page at a time', async () => {
    const { token, make } = await setup();
    for (const title of ['First', 'Second', 'Third']) {
      await make({ type: 'gift', title });
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const first = await search(token, 'limit=2');
    expect(titles(first)).toEqual(['Third', 'Second']);
    expect(first.body.nextCursor).toBeTruthy();
    const second = await search(token, `limit=2&cursor=${first.body.nextCursor}`);
    expect(titles(second)).toEqual(['First']);
    expect(second.body.nextCursor).toBeNull();
  });

  it('copes with search words that are just punctuation, and needs signing in', async () => {
    const { token, make } = await setup();
    await make({ type: 'gift', title: 'Rice' });
    expect((await search(token, 'q=%22%22%20-')).status).toBe(200);
    expect((await api('GET', '/api/v1/listings')).status).toBe(401);
  });
});
