// My listings, grouped by status, with how many new requests each has.
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { MyListing } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const { items } = await apiFor(event).get<{ items: MyListing[] }>('/api/v1/me/listings');
  return { listings: items };
});
