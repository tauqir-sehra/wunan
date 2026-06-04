// My agreements, grouped as given, received, lent, borrowed, provided (FR-026).
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { Agreement } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const { items } = await apiFor(event).get<{ items: Agreement[] }>('/api/v1/me/agreements');
  return { agreements: items };
});
