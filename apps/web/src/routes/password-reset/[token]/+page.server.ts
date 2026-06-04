// Choose a new password from the emailed link (single use, one hour).
import { fail } from '@sveltejs/kit';
import { apiFor, toApiError } from '#lib/api.ts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async (event) => {
    const form = await event.request.formData();
    const newPassword = String(form.get('password') ?? '');
    if (newPassword !== String(form.get('confirm') ?? '')) {
      return fail(400, { fields: { confirm: 'The two passwords are different. Please type them again.' } });
    }
    const response = await apiFor(event).raw('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: event.params.token, newPassword })
    });
    if (!response.ok) {
      const error = await toApiError(response);
      return fail(error.status, { error: error.message });
    }
    return { done: true };
  }
};
