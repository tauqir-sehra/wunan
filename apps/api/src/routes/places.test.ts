// Place suggestions (002 US7; FR-027, FR-028; research §1), against the stand-in Photon server.
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config.ts';
import { clearPlaceCache } from '../modules/places.ts';
import { receivedQueries, startPlacesStub } from '../test/places-stub.ts';
import { api, createFounder, signIn } from '../test/setup.ts';

let stub: { server: Server; url: string };
beforeAll(async () => {
  stub = await startPlacesStub();
});
afterAll(() => {
  stub.server.close();
  config.PLACES_URL = '';
});
beforeEach(() => {
  config.PLACES_URL = stub.url;
  config.PLACES_BIAS = '';
  receivedQueries.length = 0;
  clearPlaceCache();
});

const lookup = (token: string, q: string) => api('GET', `/api/v1/places?q=${encodeURIComponent(q)}`, { token });

describe('place suggestions', () => {
  it('turns results into places with their neighbourhood and city', async () => {
    const token = await signIn(await createFounder());
    const result = await lookup(token, 'Riv');
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([
      expect.objectContaining({ label: 'Riverside, Springfield', neighbourhood: 'Riverside', city: 'Springfield', source: 'suggestion', display: 'Riverside, Springfield' }),
      expect.objectContaining({ label: '1 Mill Street, Riverside, Springfield', houseNumber: '1', street: 'Mill Street', postcode: 'SP1 2AB' }),
      expect.objectContaining({ label: 'Riverside Library, Mill Street, Riverside, Springfield', name: 'Riverside Library' })
    ]);
    const city = (await lookup(token, 'Springfield')).body.items.find((p: { label: string }) => p.label === 'Springfield');
    expect(city).toMatchObject({ city: 'Springfield' });
    expect(city.neighbourhood).toBeUndefined();
  });

  it('sends only what was typed and the operator bias, and remembers answers for a while', async () => {
    config.PLACES_BIAS = '52.4,-1.5';
    const token = await signIn(await createFounder());
    await lookup(token, 'Old Town');
    await lookup(token, 'old town');
    expect(receivedQueries).toHaveLength(1);
    expect(Object.fromEntries(receivedQueries[0]!)).toEqual({ q: 'Old Town', limit: '8', lang: 'en', lat: '52.4', lon: '-1.5' });
  });

  it('needs 3 to 100 characters and a signed-in member', async () => {
    const token = await signIn(await createFounder());
    expect((await lookup(token, 'Ri')).status).toBe(400);
    expect((await lookup(token, 'x'.repeat(101))).status).toBe(400);
    expect((await api('GET', '/api/v1/places?q=Riverside')).status).toBe(401);
  });

  it('says plainly when suggestions are off, slow, or failing', async () => {
    const token = await signIn(await createFounder());
    expect((await lookup(token, 'broken street')).body.error.code).toBe('places_unavailable');
    expect((await lookup(token, 'slow lane')).status).toBe(503);
    config.PLACES_URL = '';
    expect((await lookup(token, 'Riverside')).status).toBe(503);
  });

  it('is limited to 60 a minute', async () => {
    const token = await signIn(await createFounder());
    for (let i = 0; i < 60; i += 1) await lookup(token, `Riverside ${i}`);
    expect((await lookup(token, 'Riverside again')).status).toBe(429);
  });
});
