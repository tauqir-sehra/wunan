// The link from the confirmation email. Confirming needs one button press, so email services
// that open links to scan them can't use up the link before the person sees it.
import { fail, redirect } from '@sveltejs/kit';
import { ApiError, apiFor } from '#lib/api.ts';
import { setSessionCookie } from '#lib/session.ts';
import type { Actions } from './$types';

export const actions: Actions = {
  confirm: async (event) => {
    try {
      const { token } = await apiFor(event).post<{ token: string }>('/api/v1/invitations/confirm', {
        token: event.params.token
      });
      setSessionCookie(event.cookies, event.url, token);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return fail(error.status, { error: error.message });
    }
    redirect(303, '/listings?welcome=1');
  }
};
