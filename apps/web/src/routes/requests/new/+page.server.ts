// Ask for something (003 US1): one form, needing JavaScript like the offering form (research §11).
// Only the kind and title are required; the API checks the rest and says what to fix.
import { redirect } from '@sveltejs/kit';
import { formAction } from '#lib/form-action.ts';
import { formValues } from '#lib/offering-form.ts';
import { requestBody } from '#lib/request-form.ts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: formAction(async ({ form, api }) => {
    const created = await api.post<{ id: string }>('/api/v1/requests', requestBody(formValues(form)));
    redirect(303, `/requests/${created.id}?posted=1`);
  })
};
