// Offerings that might already answer a request being written (003 FR-009), for RequestSuggestions.
// Passes the kind, words, and area to the API. Reading changes nothing, so no origin check is needed.
import { json } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import type { Offering } from '@wunan/shared';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) return json({ items: [] }, { status: 401 });
  const query = new URLSearchParams();
  for (const name of ['kind', 'q', 'area']) {
    const value = event.url.searchParams.get(name);
    if (value) query.set(name, value);
  }
  try {
    return json(await apiFor(event).get<{ items: Offering[] }>(`/api/v1/requests/suggestions?${query}`));
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return json({ items: [] });
  }
};
