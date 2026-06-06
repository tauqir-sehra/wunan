// Passes the API's live stream for one conversation through to the browser (FR-018a), using the
// member's session, so the browser never talks to the API directly.
import { error } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in.');
  const upstream = await apiFor(event).raw(
    `/api/v1/conversations/${encodeURIComponent(event.params.id)}/live`,
    {
      headers: { accept: 'text/event-stream' },
      signal: event.request.signal // Stops the API stream when the browser goes away.
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
