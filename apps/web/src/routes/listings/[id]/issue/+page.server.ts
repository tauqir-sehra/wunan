// Raise an issue about a listing with its owner, as a page of its own: what the "Raise an issue"
// pop-up does when JavaScript is off (001 FR-013a). The listing itself never changes.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Listing } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  listing: await loadOr404(() => apiFor(event).get<Listing>(`/api/v1/listings/${encodeURIComponent(event.params.id)}`))
}));

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/listings/${encodeURIComponent(event.params.id ?? '')}/flags`, { request: text(form, 'request') ?? '' });
    redirect(303, `/listings/${event.params.id}?issueSent=1`);
  })
};
