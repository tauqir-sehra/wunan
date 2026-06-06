// Passes the API's live stream of this page's public messages through to the browser (003
// FR-023g), using the member's session, so the browser never talks to the API directly.
import { error } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in.');
  const upstream = await apiFor(event).raw(
    `/api/v1/requests/${encodeURIComponent(event.params.id)}/messages/live`,
    {
      headers: { accept: 'text/event-stream' },
      signal: event.request.signal
    }
  );
  if (!upstream.ok || !upstream.body)
    error(upstream.status === 404 ? 404 : 502, 'Live updates are not available.');
  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no'
    }
  });
};
