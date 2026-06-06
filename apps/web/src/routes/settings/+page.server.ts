// Settings: profile, private contact details, and password, saved together with one button
// (US1; FR-019). The password only changes when a new one is typed.
import { fail } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import { memberLoad } from '#lib/load.ts';
import { formAction, text, textValues } from '#lib/form-action.ts';
import type { ContactDetails, Me } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const [me, contact] = await Promise.all([api.get<Me>('/api/v1/me'), api.get<ContactDetails>('/api/v1/me/contact')]);
  return { me, contact };
});

export const actions: Actions = {
  default: formAction(async ({ form, api }) => {
    // Each part is saved on its own, so one problem doesn't stop the rest; all problems are shown.
    const fields: Record<string, string> = {};
    const problems: string[] = [];
    const attempt = async (save: () => Promise<unknown>) => {
      try {
        await save();
        return true;
      } catch (error) {
        if (!(error instanceof ApiError) || error.status === 401) throw error;
        Object.assign(fields, error.fields);
        if (Object.keys(error.fields).length === 0) problems.push(error.message);
        return false;
      }
    };
    await attempt(() => api.patch('/api/v1/me', { displayName: String(form.get('displayName') ?? ''), bio: text(form, 'bio') ?? null }));
    await attempt(() => api.put('/api/v1/me/contact', { sharePhone: text(form, 'sharePhone') ?? null, shareEmail: text(form, 'shareEmail') ?? null }));
    const newPassword = String(form.get('newPassword') ?? '');
    const currentPassword = String(form.get('currentPassword') ?? '');
    let passwordChanged = false;
    if (newPassword || currentPassword) {
      if (!newPassword) fields.newPassword = 'Please type the new password too, or leave both password boxes empty.';
      else passwordChanged = await attempt(() => api.post('/api/v1/me/password', { currentPassword, newPassword }));
    }
    if (Object.keys(fields).length || problems.length) {
      return fail(400, { error: problems[0] ?? 'Some details need fixing. Everything else was saved.', fields, values: textValues(form) });
    }
    return { saved: true, passwordChanged };
  })
};
