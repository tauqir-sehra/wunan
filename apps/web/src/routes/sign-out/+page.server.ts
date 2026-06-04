// Signing out ends the session in the API and forgets the cookie.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { clearSessionCookie } from '#lib/session.ts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async (event) => {
    if (event.locals.token) {
      await apiFor(event).raw('/api/auth/sign-out', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}'
      });
    }
    clearSessionCookie(event.cookies);
    redirect(303, '/sign-in');
  }
};
