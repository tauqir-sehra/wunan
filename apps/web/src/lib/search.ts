// One page of Find's results for the filters in a URL. Used by the Find page itself and by
// "Show more", which adds the next page under the results already shown.
import type { RequestEvent } from '@sveltejs/kit';
import { apiFor } from './api.ts';
import type { Listing, ListingType } from '@wunan/shared';

const FILTERS = ['q', 'area', 'includeLent'] as const;
export const ALL_KINDS: ListingType[] = ['lend', 'gift', 'trade', 'service'];

export async function searchPage(event: Pick<RequestEvent, 'locals' | 'getClientAddress'>, url: URL) {
  const filters = Object.fromEntries(FILTERS.map((name) => [name, url.searchParams.get(name) ?? ''])) as Record<(typeof FILTERS)[number], string>;
  // Kinds arrive as ticked boxes (type=lend&type=gift) or a list (type=lend,gift). None means all.
  const picked = url.searchParams.getAll('type').flatMap((v) => v.split(',')).filter((v): v is ListingType => ALL_KINDS.includes(v as ListingType));
  const kinds = picked.length ? [...new Set(picked)] : ALL_KINDS;
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  if (kinds.length < ALL_KINDS.length) query.set('type', kinds.join(','));
  const cursor = url.searchParams.get('cursor');
  if (cursor) query.set('cursor', cursor);

  const result = await apiFor(event).get<{ items: Listing[]; nextCursor: string | null }>(`/api/v1/listings?${query}`);
  const next = new URLSearchParams(query);
  if (result.nextCursor) next.set('cursor', result.nextCursor);
  return {
    filters,
    kinds,
    listings: result.items,
    /** The next page's query string, or null when there is no more. */
    nextQuery: result.nextCursor ? next.toString() : null,
    isLaterPage: Boolean(cursor)
  };
}
