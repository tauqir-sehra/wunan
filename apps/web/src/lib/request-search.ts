// One page of the Requests page's results for the filters in a URL (003 FR-020 to FR-022). Used by
// the page itself and by "Show more". `mine=true` lists the member's own requests instead.
import type { RequestEvent } from '@sveltejs/kit';
import { apiFor } from './api.ts';
import type { RequestKind, RequestSummary } from '@wunan/shared';

const FILTERS = ['q', 'area'] as const;
export const ALL_REQUEST_KINDS: RequestKind[] = ['borrow', 'receive', 'trade', 'service'];

export async function requestPage(event: Pick<RequestEvent, 'locals' | 'getClientAddress'>, url: URL) {
  const filters = Object.fromEntries(FILTERS.map((name) => [name, url.searchParams.get(name) ?? ''])) as Record<(typeof FILTERS)[number], string>;
  const picked = url.searchParams.getAll('kind').flatMap((v) => v.split(',')).filter((v): v is RequestKind => ALL_REQUEST_KINDS.includes(v as RequestKind));
  const kinds = picked.length ? [...new Set(picked)] : ALL_REQUEST_KINDS;
  const mine = url.searchParams.get('mine') === 'true';
  const query = new URLSearchParams();
  if (mine) query.set('mine', 'true');
  for (const [name, value] of Object.entries(filters)) if (value) query.set(name, value);
  if (kinds.length < ALL_REQUEST_KINDS.length) query.set('kind', kinds.join(','));
  const cursor = url.searchParams.get('cursor');
  if (cursor) query.set('cursor', cursor);

  const result = await apiFor(event).get<{ items: RequestSummary[]; nextCursor: string | null }>(`/api/v1/requests?${query}`);
  const next = new URLSearchParams(query);
  if (result.nextCursor) next.set('cursor', result.nextCursor);
  return {
    mine,
    filters,
    kinds,
    requests: result.items,
    nextQuery: result.nextCursor ? next.toString() : null,
    isLaterPage: Boolean(cursor)
  };
}
