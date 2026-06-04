// Settings: profile, private contact details, password (US1; FR-019).
import { apiFor } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import { formAction, text } from '#lib/form-action.ts';
import type { ContactDetails, Me } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const [me, contact] = await Promise.all([api.get<Me>('/api/v1/me'), api.get<ContactDetails>('/api/v1/me/contact')]);
  return { me, contact };
});

export const actions: Actions = {
  profile: formAction(async ({ form, api }) => {
    await api.patch('/api/v1/me', { displayName: String(form.get('displayName') ?? ''), bio: text(form, 'bio') ?? null });
    return { saved: 'profile' };
  }),
  contact: formAction(async ({ form, api }) => {
    await api.put('/api/v1/me/contact', {
      sharePhone: text(form, 'sharePhone') ?? null,
      shareEmail: text(form, 'shareEmail') ?? null
    });
    return { saved: 'contact' };
  }),
  password: formAction(async ({ form, api }) => {
    await api.post('/api/v1/me/password', {
      currentPassword: String(form.get('currentPassword') ?? ''),
      newPassword: String(form.get('newPassword') ?? '')
    });
    return { saved: 'password' };
  })
};
