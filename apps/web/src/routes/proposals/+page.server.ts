// My proposals (002 FR-024): ones I made and ones on my offerings, open first.
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { ProposalSummary } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const role = event.url.searchParams.get('role');
  const query = role === 'requester' || role === 'lister' ? `?role=${role}&limit=50` : '?limit=50';
  const { items } = await apiFor(event).get<{ items: ProposalSummary[] }>(`/api/v1/proposals${query}`);
  return { items, role: role === 'requester' || role === 'lister' ? role : null };
});
