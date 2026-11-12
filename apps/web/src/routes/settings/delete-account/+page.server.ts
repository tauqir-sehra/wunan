// Leaving wunan (FR-032; research §16): explains what happens, lists open loans first, and
// needs the password. Afterwards the member is signed out.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { memberLoad } from '#lib/load.ts';
import { clearSessionCookie } from '#lib/session.ts';
import type { ArrangementList } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const list = await apiFor(event).get<ArrangementList>('/api/v1/arrangements');
  // Loans out or due back: agreed, not returned, so never under "Finished".
  const openLoans = [...list.needsYou, ...list.inProgress].filter(
    (a) => a.offering.type === 'lend' && (a.stage === 'agreed' || a.stage === 'on_loan')
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
