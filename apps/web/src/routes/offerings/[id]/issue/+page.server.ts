// Raise an issue about an offering with its owner, as a page of its own: what the "Raise an issue"
// pop-up does when JavaScript is off (001 FR-013a). The offering itself never changes.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Offering } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  offering: await loadOr404(() => apiFor(event).get<Offering>(`/api/v1/offerings/${encodeURIComponent(event.params.id)}`))
}));

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/offerings/${encodeURIComponent(event.params.id ?? '')}/flags`, { request: text(form, 'request') ?? '' });
    redirect(303, `/offerings/${event.params.id}?issueSent=1`);
  })
};
