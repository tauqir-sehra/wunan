// Leaving wunan (FR-032; research §16): explains what happens, lists open loans first, and
// needs the password. Afterwards the member is signed out.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { memberLoad } from '#lib/load.ts';
import { clearSessionCookie } from '#lib/session.ts';
import type { Agreement } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const { items } = await apiFor(event).get<{ items: Agreement[] }>('/api/v1/me/agreements');
  const openLoans = items.filter(
    (a) => a.outcome === 'lent' && !a.returnedAt && a.confirmation !== 'cancelled' && a.myRole !== 'mediator'
  );
  return { openLoans };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.delete('/api/v1/me', { password: String(form.get('password') ?? '') });
    clearSessionCookie(event.cookies, event.url);
    redirect(303, '/goodbye');
  })
};
