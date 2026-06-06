// One agreement, made when a proposal was accepted (002 FR-018): what was agreed, and for loans,
// marking it returned (owner).
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Agreement } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  agreement: await loadOr404(() => apiFor(event).get<Agreement>(`/api/v1/agreements/${encodeURIComponent(event.params.id)}`))
}));

export const actions: Actions = {
  returned: formAction(async ({ event, api }) => {
    await api.post(`/api/v1/agreements/${encodeURIComponent(event.params.id ?? '')}/returned`);
    return { done: 'returned' };
  })
};
