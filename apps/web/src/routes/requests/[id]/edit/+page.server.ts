// Edit a request (asker only, while open). The kind can't change.
import { error, redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { formValues } from '#lib/offering-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { requestBody } from '#lib/request-form.ts';
import type { Request } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const request = await loadOr404(() =>
    apiFor(event).get<Request>(`/api/v1/requests/${encodeURIComponent(event.params.id)}`)
  );
  if (!request.canEdit)
    error(403, 'Only the person who asked can edit this request, while it is open.');
  return { request };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.patch(
      `/api/v1/requests/${encodeURIComponent(event.params.id ?? '')}`,
      requestBody(formValues(form), { forEdit: true })
    );
    redirect(303, `/requests/${event.params.id}?saved=1`);
  })
};
