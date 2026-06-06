// Serves offering photos to signed-in members by passing them through from the API, so the
// browser's session cookie applies. Never cached by shared caches.
import { error } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(404, 'Not found');
  const response = await apiFor(event).raw(`/api/v1/photos/${encodeURIComponent(event.params.key)}`);
  if (!response.ok) error(404, 'Not found');
  return new Response(response.body, {
    headers: {
      'content-type': response.headers.get('content-type') ?? 'image/webp',
      'cache-control': response.headers.get('cache-control') ?? 'private, max-age=86400'
    }
  });
};
