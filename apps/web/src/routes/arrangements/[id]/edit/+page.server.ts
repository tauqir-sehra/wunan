// The requester changes what they asked for while it's open (002 FR-016). Each change is noted in
// the messages.
import { error, redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { formValues } from '#lib/offering-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { arrangementBody, detailValues } from '#lib/arrangement-form.ts';
import type { Arrangement, Offering } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const arrangement = await loadOr404(() =>
    api.get<Arrangement>(`/api/v1/arrangements/${encodeURIComponent(event.params.id)}`)
  );
  if (!arrangement.canEdit)
    error(403, 'Only the person who asked can change this, while it is open.');
  const offering = await api.get<Offering>(`/api/v1/offerings/${arrangement.offering.id}`);
  const values = detailValues(arrangement);
  return { arrangement, offering, values };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    const arrangement = await api.get<Arrangement>(
      `/api/v1/arrangements/${encodeURIComponent(event.params.id ?? '')}`
    );
    await api.patch(
      `/api/v1/arrangements/${arrangement.id}`,
      arrangementBody(formValues(form), arrangement.offering.type, { forEdit: true })
    );
    redirect(303, `/arrangements/${arrangement.id}#decision`);
  })
};
