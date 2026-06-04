// Photo endpoints (contracts/api.md, "Listings"). Uploads are multipart; images are served only
// to signed-in members, never cached by shared caches.
import { createRoute, z } from '@hono/zod-openapi';
import { ListingPhoto, UpdatePhoto } from '@wunan/shared';
import { createRouter } from '../app-router.ts';
import { ApiError } from '../lib/errors.ts';
import { requireMember } from '../lib/require-member.ts';
import * as photos from '../modules/photos.ts';

export const photoRoutes = createRouter();
photoRoutes.use('/listings/*', requireMember);
photoRoutes.use('/photos/*', requireMember);

const security = [{ bearer: [] }];
const ListingId = z.object({ id: z.uuid() });
const PhotoIds = z.object({ id: z.uuid(), photoId: z.uuid() });
const Upload = z.object({ file: z.any().describe('The image file'), alt: z.string().max(200).optional() });

photoRoutes.openapi(
  createRoute({
    method: 'post',
    path: '/listings/{id}/photos',
    summary: 'Add a photo (up to 6 per listing, 10 MB each; metadata is removed)',
    security,
    request: { params: ListingId, body: { content: { 'multipart/form-data': { schema: Upload } } } },
    responses: { 201: { description: 'The stored photo', content: { 'application/json': { schema: ListingPhoto } } } }
  }),
  async (c) => {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError(400, 'validation_failed', 'Some details need fixing.', { file: 'Please choose a photo.' });
    }
    const alt = String(form.get('alt') ?? '').trim().slice(0, 200) || null;
    return c.json(await photos.addPhoto(c.req.valid('param').id, c.get('member').id, file, alt), 201);
  }
);

photoRoutes.openapi(
  createRoute({
    method: 'patch',
    path: '/listings/{id}/photos/{photoId}',
    summary: "Change a photo's description or order",
    security,
    request: { params: PhotoIds, body: { content: { 'application/json': { schema: UpdatePhoto } } } },
    responses: { 200: { description: 'The photo', content: { 'application/json': { schema: ListingPhoto } } } }
  }),
  async (c) => {
    const { id, photoId } = c.req.valid('param');
    return c.json(await photos.updatePhoto(id, c.get('member').id, photoId, c.req.valid('json')), 200);
  }
);

photoRoutes.openapi(
  createRoute({
    method: 'delete',
    path: '/listings/{id}/photos/{photoId}',
    summary: 'Delete a photo',
    security,
    request: { params: PhotoIds },
    responses: { 204: { description: 'Deleted' } }
  }),
  async (c) => {
    const { id, photoId } = c.req.valid('param');
    await photos.deletePhoto(id, c.get('member').id, photoId);
    return c.body(null, 204);
  }
);

photoRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/photos/{key}',
    summary: 'Photo image (members only)',
    security,
    request: { params: z.object({ key: z.string() }) },
    responses: { 200: { description: 'WebP image', content: { 'image/webp': { schema: z.any() } } } }
  }),
  async (c) => {
    const bytes = await photos.readPhoto(c.req.valid('param').key);
    return c.body(new Uint8Array(bytes), 200, {
      'Content-Type': 'image/webp',
      'Cache-Control': 'private, max-age=86400'
    });
  }
);
