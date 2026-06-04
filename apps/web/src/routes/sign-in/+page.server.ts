// Sign in with email and password. One generic error for wrong details; a clear next step for
// members who haven't confirmed their email yet (FR-001a, FR-001b).
import { fail, redirect } from '@sveltejs/kit';
import { ApiError, apiFor } from '#lib/api.ts';
import { safeRedirectPath } from '#lib/session.ts';
import { signInWithPassword } from '#lib/sign-in.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
  if (locals.member) redirect(303, safeRedirectPath(url.searchParams.get('redirectTo')));
  return {};
};

export const actions: Actions = {
  signIn: async (event) => {
    const form = await event.request.formData();
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    try {
      await signInWithPassword(event, email, password);
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return fail(error.status, {
        email,
        error: error.message,
        notConfirmed: error.code === 'email_not_confirmed'
      });
    }
    redirect(303, safeRedirectPath(event.url.searchParams.get('redirectTo')));
  },

  resendConfirmation: async (event) => {
    const form = await event.request.formData();
    const email = String(form.get('email') ?? '').trim();
    try {
      await apiFor(event).post('/api/v1/invitations/resend-confirmation', { email });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return fail(error.status, { email, notConfirmed: true, error: error.message });
    }
    return { email, resent: true };
  }
};
