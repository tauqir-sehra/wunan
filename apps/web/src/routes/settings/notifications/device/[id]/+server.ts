// Stops notifications on one of the member's devices (forwards to the API, which checks that
// the device is theirs).
import { error } from '@sveltejs/kit';
import { ApiError, apiFor } from '#lib/api.ts';
import { sameOrigin } from '#lib/same-origin.ts';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async (event) => {
  if (!event.locals.member) error(401, 'Please sign in to continue.');
  sameOrigin(event);
  try {
    await apiFor(event).delete(`/api/v1/me/push-subscriptions/${encodeURIComponent(event.params.id)}`);
  } catch (problem) {
    if (!(problem instanceof ApiError)) throw problem;
    error(problem.status, problem.message);
  }
  return new Response(null, { status: 204 });
};
