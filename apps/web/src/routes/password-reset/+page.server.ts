// Ask for a password-reset link. Always the same answer, so nobody can find out who is a member.
import { SITE_URL } from '$app/env/private';
import { apiFor } from '#lib/api.ts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const email = String(form.get('email') ?? '').trim();
    await apiFor(event).raw('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, redirectTo: `${SITE_URL}/password-reset` })
    });
    return { sent: true };
  }
};
