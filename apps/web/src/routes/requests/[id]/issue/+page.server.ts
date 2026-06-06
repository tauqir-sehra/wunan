// Raise an issue about a request with its asker, as a page of its own: what the "Raise an issue"
// pop-up does when JavaScript is off (003 FR-025). The request itself never changes.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Request } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  request: await loadOr404(() =>
    apiFor(event).get<Request>(`/api/v1/requests/${encodeURIComponent(event.params.id)}`)
  )
}));

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/requests/${encodeURIComponent(event.params.id ?? '')}/flags`, {
      request: text(form, 'request') ?? ''
    });
    redirect(303, `/requests/${event.params.id}?issueSent=1`);
  })
};
