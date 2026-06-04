// Ask for help with an agreement (FR-027, FR-028): describe the problem, review, confirm.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Agreement } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  agreement: await loadOr404(() => apiFor(event).get<Agreement>(`/api/v1/agreements/${encodeURIComponent(event.params.id)}`))
}));

export const actions: Actions = {
  review: async ({ request }) => ({ review: text(await request.formData(), 'description') ?? '' }),
  send: formAction(async ({ event, form, api }) => {
    const report = await api.post<{ id: string }>(`/api/v1/agreements/${encodeURIComponent(event.params.id ?? '')}/reports`, {
      description: String(form.get('description') ?? '')
    });
    redirect(303, `/reports/${report.id}?asked=1`);
  })
};
