// One offering: details for everyone, status changes for the owner, requests from others
// (FR-012 to FR-014, FR-013a, FR-013b).
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { loadThread, threadActions } from '#lib/public-thread.ts';
import type { Offering } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const offering = await loadOr404(() => apiFor(event).get<Offering>(`/api/v1/offerings/${encodeURIComponent(event.params.id)}`));
  return { offering, thread: await loadThread(event, 'offerings', offering.id) };
});

const statusChange = (change: 'pause' | 'resume' | 'reopen') =>
  formAction(async ({ event, api }) => {
    await api.post(`/api/v1/offerings/${encodeURIComponent(event.params.id ?? '')}/${change}`);
    return { done: change };
  });

export const actions: Actions = {
  ...threadActions('offerings'),
  pause: statusChange('pause'),
  resume: statusChange('resume'),
  reopen: statusChange('reopen'),
  // Removing asks first; the second press (with `confirmed`) removes it. It can be reopened later.
  remove: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirmRemove: true };
    await api.post(`/api/v1/offerings/${encodeURIComponent(event.params.id ?? '')}/remove`);
    return { done: 'remove' };
  }),
  flag: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/offerings/${encodeURIComponent(event.params.id ?? '')}/flags`, { request: text(form, 'request') ?? '' });
    return { done: 'flag' };
  })
};
