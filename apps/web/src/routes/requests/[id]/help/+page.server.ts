// The choices behind "I can help with this" as a page of its own, for when JavaScript is off (003 FR-010, FR-013).
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { offeringTypeFor, type MyOffering, type Request } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const request = await loadOr404(() =>
    api.get<Request>(`/api/v1/requests/${encodeURIComponent(event.params.id)}`)
  );
  const linked = new Set(request.links.map((l) => l.offering.id));
  const myOfferings = (await api.get<{ items: MyOffering[] }>('/api/v1/me/offerings')).items.filter(
    (l) => l.type === offeringTypeFor[request.kind] && l.status === 'available' && !linked.has(l.id)
  );
  return { request, myOfferings };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/requests/${encodeURIComponent(event.params.id ?? '')}/links`, {
      offeringId: text(form, 'offeringId') ?? ''
    });
    redirect(303, `/requests/${event.params.id}?linked=1#actions`);
  })
};
