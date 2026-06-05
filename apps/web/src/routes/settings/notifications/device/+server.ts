// Forwards this browser's push subscription to the API (contracts/pages.md, "Device notification
// endpoints"). Called by the notifications page after the member pressed the button.
import { error, json } from '@sveltejs/kit';
import { ApiError, apiFor } from '#lib/api.ts';
import { sameOrigin } from '#lib/same-origin.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in to continue.');
  sameOrigin(event);
  const details = await event.request.json().catch(() => null);
  try {
    return json(await apiFor(event).post('/api/v1/me/push-subscriptions', details ?? {}), { status: 201 });
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem;
    const message = Object.values(problem.fields)[0] ?? problem.message;
    return json({ error: message }, { status: problem.status });
  }
};
