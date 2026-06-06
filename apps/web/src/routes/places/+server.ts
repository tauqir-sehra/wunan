// Place suggestions for PlaceField (002 FR-027): passes what was typed to the API, which asks the
// operator's place service. The browser never reaches the API or the place service itself. Reading
// suggestions changes nothing, and other sites can't read the answer, so no origin check is needed.
import { json } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import type { PlaceView } from '@wunan/shared';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
  if (!event.locals.member) return json({ items: [], unavailable: true }, { status: 401 });
  const q = event.url.searchParams.get('q') ?? '';
  try {
    const result = await apiFor(event).get<{ items: PlaceView[] }>(`/api/v1/places?q=${encodeURIComponent(q)}`);
    return json({ items: result.items, unavailable: false });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    // Too short, too many, or the service is off: the field simply stays plain text.
    return json({ items: [], unavailable: error.status === 503 });
  }
};
