// One request (003 US1, US3, US4, US7): details for everyone; editing, closing, and reopening for
// the asker; answering ("I can help with this" or linking an offering) and raising an issue for others.
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { loadThread, threadActions } from '#lib/public-thread.ts';
import { offeringTypeFor, type MyOffering, type Request } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const request = await loadOr404(() =>
    api.get<Request>(`/api/v1/requests/${encodeURIComponent(event.params.id)}`)
  );
  // For "Link one of your offerings": my available offerings of the type that answers this request.
  const linked = new Set(request.links.map((l) => l.offering.id));
  const myOfferings = request.canAnswer
    ? (await api.get<{ items: MyOffering[] }>('/api/v1/me/offerings')).items.filter(
        (l) =>
          l.type === offeringTypeFor[request.kind] && l.status === 'available' && !linked.has(l.id)
      )
    : [];
  return { request, myOfferings, thread: await loadThread(event, 'requests', request.id) };
});

const base = (id: string | undefined) => `/api/v1/requests/${encodeURIComponent(id ?? '')}`;

export const actions: Actions = {
  ...threadActions('requests'),
  // Closing asks first; the second press (with `confirmed`) closes it. It can be reopened later.
  close: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirmClose: true };
    await api.post(`${base(event.params.id)}/close`);
    return { done: 'close' };
  }),
  reopen: formAction(async ({ event, api }) => {
    await api.post(`${base(event.params.id)}/reopen`);
    return { done: 'reopen' };
  }),
  link: formAction(async ({ event, form, api }) => {
    await api.post(`${base(event.params.id)}/links`, { offeringId: text(form, 'offeringId') ?? '' });
    return { done: 'link' };
  }),
  unlink: formAction(async ({ event, form, api }) => {
    await api.delete(
      `${base(event.params.id)}/links/${encodeURIComponent(text(form, 'linkId') ?? '')}`
    );
    return { done: 'unlink' };
  }),
  flag: formAction(async ({ event, form, api }) => {
    await api.post(`${base(event.params.id)}/flags`, { request: text(form, 'request') ?? '' });
    return { done: 'flag' };
  })
};
