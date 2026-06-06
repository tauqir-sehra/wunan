// Offering photos (US2; FR-012; research §8).
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { app } from '../app.ts';
import { api, createFounder, signIn } from '../test/setup.ts';

/** A 2400×1800 JPEG carrying GPS coordinates, like a phone photo taken with location on. */
async function phonePhoto() {
  return sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#7a9' } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1', GPSLongitudeRef: 'W', GPSLongitude: '0/1 7/1 0/1' } })
    .toBuffer();
}

async function upload(token: string, offeringId: string, bytes: Uint8Array, type = 'image/jpeg', alt = 'A bag of rice') {
  const form = new FormData();
  form.set('file', new File([new Uint8Array(bytes)], 'photo', { type }));
  form.set('alt', alt);
  return api('POST', `/api/v1/offerings/${offeringId}/photos`, { token, body: form });
}

async function setup() {
  const founder = await createFounder();
  const token = await signIn(founder);
  const { body } = await api('POST', '/api/v1/offerings', { token, body: { type: 'gift', title: 'Rice' } });
  return { token, offeringId: body.id as string };
}

describe('photos', () => {
  it('re-encodes uploads as WebP, at most 1600 px, with no location data', async () => {
    const { token, offeringId } = await setup();
    const original = await phonePhoto();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const uploaded = await upload(token, offeringId, original);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.alt).toBe('A bag of rice');

    const served = await app.request(`/api/v1/photos/${uploaded.body.key}`, { headers: { authorization: `Bearer ${token}` } });
    expect(served.status).toBe(200);
    expect(served.headers.get('cache-control')).toContain('private');
    const meta = await sharp(Buffer.from(await served.arrayBuffer())).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1600);
    expect(meta.exif).toBeUndefined();

    const offering = await api('GET', `/api/v1/offerings/${offeringId}`, { token });
    expect(offering.body.photos).toEqual([expect.objectContaining({ key: uploaded.body.key, alt: 'A bag of rice' })]);
  });

  it('refuses files that are not images', async () => {
    const { token, offeringId } = await setup();
    const result = await upload(token, offeringId, new TextEncoder().encode('not a photo'), 'image/jpeg');
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('not_an_image');
  });

  it('refuses SVG files, even though they are images', async () => {
    const { token, offeringId } = await setup();
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');
    const result = await upload(token, offeringId, svg, 'image/svg+xml');
    expect(result.status).toBe(400);
    expect(result.body.error.code).toBe('not_an_image');
  });

  it('refuses files over 10 MB', async () => {
    const { token, offeringId } = await setup();
    const result = await upload(token, offeringId, new Uint8Array(10 * 1024 * 1024 + 1));
    expect(result.status).toBe(413);
  });

  it('allows at most 6 photos per offering', async () => {
    const { token, offeringId } = await setup();
    const small = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#000' } }).png().toBuffer();
    for (let i = 0; i < 6; i += 1) expect((await upload(token, offeringId, small, 'image/png')).status).toBe(201);
    const seventh = await upload(token, offeringId, small, 'image/png');
    expect(seventh.status).toBe(409);
    expect(seventh.body.error.code).toBe('too_many_photos');
  });

  it('serves photos only to signed-in members', async () => {
    const { token, offeringId } = await setup();
    const small = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#000' } }).png().toBuffer();
    const { body } = await upload(token, offeringId, small, 'image/png');
    expect((await api('GET', `/api/v1/photos/${body.key}`)).status).toBe(401);
    expect((await api('GET', '/api/v1/photos/..%2F..%2Fetc%2Fpasswd', { token })).status).toBe(404);
  });

  it('updates and deletes photos', async () => {
    const { token, offeringId } = await setup();
    const small = await sharp({ create: { width: 20, height: 20, channels: 3, background: '#000' } }).png().toBuffer();
    const { body } = await upload(token, offeringId, small, 'image/png');
    const updated = await api('PATCH', `/api/v1/offerings/${offeringId}/photos/${body.id}`, { token, body: { alt: 'Rice in a jar' } });
    expect(updated.body.alt).toBe('Rice in a jar');
    expect((await api('DELETE', `/api/v1/offerings/${offeringId}/photos/${body.id}`, { token })).status).toBe(204);
    expect((await api('GET', `/api/v1/photos/${body.key}`, { token })).status).toBe(404);
  });
});
