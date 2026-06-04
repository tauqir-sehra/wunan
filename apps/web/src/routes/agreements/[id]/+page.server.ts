// One agreement: confirm or say it needs a correction (other member); mark a loan returned or
// cancel while it's pending (owner, with a confirmation step).
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { Agreement } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => ({
  agreement: await loadOr404(() => apiFor(event).get<Agreement>(`/api/v1/agreements/${encodeURIComponent(event.params.id)}`))
}));

const act = (action: 'confirm' | 'dispute' | 'returned') =>
  formAction(async ({ event, api }) => {
    await api.post(`/api/v1/agreements/${encodeURIComponent(event.params.id ?? '')}/${action}`);
    return { done: action };
  });

export const actions: Actions = {
  confirm: act('confirm'),
  dispute: act('dispute'),
  returned: act('returned'),
  cancel: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirmCancel: true };
    await api.post(`/api/v1/agreements/${encodeURIComponent(event.params.id ?? '')}/cancel`);
    return { done: 'cancel' };
  })
};
