// A request for help: who is helping, the shared conversation, asking for more help, settling.
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { ProblemReport } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  report: await loadOr404(() => apiFor(event).get<ProblemReport>(`/api/v1/reports/${encodeURIComponent(event.params.id)}`))
}));

export const actions: Actions = {
  escalate: formAction(async ({ event, api }) => {
    await api.post(`/api/v1/reports/${encodeURIComponent(event.params.id ?? '')}/escalate`);
    return { done: 'escalate' };
  }),
  resolve: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/reports/${encodeURIComponent(event.params.id ?? '')}/resolve`, { outcomeNote: String(form.get('outcomeNote') ?? '') });
    return { done: 'resolve' };
  })
};
