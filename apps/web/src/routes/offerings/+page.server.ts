// Offerings, the page members land on. "All offerings": search and filter what's available
// (FR-015 to FR-017); the filters are a plain GET form, so results can be bookmarked and it works
// without JavaScript. "My offerings" (`mine=true`): the member's own, grouped by status, with how
// many new requests from members each has.
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import { searchPage } from '#lib/search.ts';
import type { MyOffering } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  if (event.url.searchParams.get('mine') === 'true') {
    const { items } = await apiFor(event).get<{ items: MyOffering[] }>('/api/v1/me/offerings');
    return { mine: true as const, myOfferings: items };
  }
  return { mine: false as const, ...(await searchPage(event, event.url)) };
});
