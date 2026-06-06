// Find, the page members land on: search and filter what's available (FR-015 to FR-017). The filters are a plain GET form,
// so results can be bookmarked and it works without JavaScript.
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { Listing, ListingType } from '@wunan/shared';
import type { PageServerLoad } from './$types';

const FILTERS = ['q', 'area', 'includeLent'] as const;
const ALL_KINDS: ListingType[] = ['lend', 'gift', 'trade', 'service'];

export const load: PageServerLoad = memberLoad(async (event) => {
  const filters = Object.fromEntries(FILTERS.map((name) => [name, event.url.searchParams.get(name) ?? ''])) as Record<(typeof FILTERS)[number], string>;
  // Kinds arrive as ticked boxes (type=lend&type=gift) or a list (type=lend,gift). None means all.
  const picked = event.url.searchParams.getAll('type').flatMap((v) => v.split(',')).filter((v): v is ListingType => ALL_KINDS.includes(v as ListingType));
  const kinds = picked.length ? [...new Set(picked)] : ALL_KINDS;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  if (kinds.length < ALL_KINDS.length) query.set('type', kinds.join(','));
  const cursor = event.url.searchParams.get('cursor');
  if (cursor) query.set('cursor', cursor);

  const result = await apiFor(event).get<{ items: Listing[]; nextCursor: string | null }>(`/api/v1/listings?${query}`);
  const next = new URLSearchParams(query);
  if (result.nextCursor) next.set('cursor', result.nextCursor);
  return {
    filters,
    kinds,
    listings: result.items,
    nextPage: result.nextCursor ? `/listings?${next}` : null,
    isLaterPage: Boolean(cursor)
  };
});
