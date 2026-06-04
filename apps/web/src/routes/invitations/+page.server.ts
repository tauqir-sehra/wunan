// My invitations: create a link to share, see who joined, cancel unused links (US1).
import { formAction } from '#lib/form-action.ts';
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import type { MyInvitation } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const { items } = await apiFor(event).get<{ items: MyInvitation[] }>('/api/v1/me/invitations');
  return { invitations: items };
});

export const actions: Actions = {
  create: formAction(async ({ api }) => {
    const created = await api.post<{ link: string; expiresAt: string }>('/api/v1/invitations');
    return { created };
  }),
  // Two steps: the first press asks "are you sure?", the second (with `confirmed`) cancels.
  cancel: formAction(async ({ form, api }) => {
    const id = String(form.get('id') ?? '');
    if (form.get('confirmed') !== 'yes') return { confirmCancel: id };
    await api.post(`/api/v1/invitations/${encodeURIComponent(id)}/cancel`);
    return { cancelled: true };
  })
};
