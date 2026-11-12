// My arrangements (004 FR-001 to FR-007): under "Waiting on you", "In progress" and "Finished", with a
// choice of all, the ones I asked for, or the ones on my offerings. A later page of "Finished"
// (`?group=finished&cursor=`) comes here too when JavaScript is off.
import { apiFor } from '#lib/api.ts';
import { arrangementSide, listQuery } from '#lib/arrangement-list.ts';
import { memberLoad } from '#lib/load.ts';
import type { ArrangementList } from '@wunan/shared';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  ...(await apiFor(event).get<ArrangementList>(`/api/v1/arrangements${listQuery(event.url)}`)),
  side: arrangementSide(event.url)
}));
