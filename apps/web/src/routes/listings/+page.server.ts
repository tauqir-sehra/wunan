// Find: search and filter what's available (FR-015 to FR-017). The filters are a plain GET form,
// so results can be bookmarked and it works without JavaScript.
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { Listing } from '@wunan/shared';
import type { PageServerLoad } from './$types';

const FILTERS = ['q', 'type', 'area', 'includeLent'] as const;

export const load: PageServerLoad = memberLoad(async (event) => {
  const filters = Object.fromEntries(FILTERS.map((name) => [name, event.url.searchParams.get(name) ?? ''])) as Record<(typeof FILTERS)[number], string>;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  const cursor = event.url.searchParams.get('cursor');
  if (cursor) query.set('cursor', cursor);

  const result = await apiFor(event).get<{ items: Listing[]; nextCursor: string | null }>(`/api/v1/listings?${query}`);
  const next = new URLSearchParams(query);
  if (result.nextCursor) next.set('cursor', result.nextCursor);
  return {
    filters,
    listings: result.items,
    nextPage: result.nextCursor ? `/listings?${next}` : null,
    isLaterPage: Boolean(cursor)
  };
});
