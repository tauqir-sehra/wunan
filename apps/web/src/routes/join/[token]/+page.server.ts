// Joining from an invitation link (US1; FR-001, FR-001b). Public page.
import { fail } from '@sveltejs/kit';
import { ApiError, apiFor } from '#lib/api.ts';
import { textValues } from '#lib/form-action.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
  try {
    const check = await apiFor(event).get<{ inviterName: string }>(`/api/v1/invitations/${encodeURIComponent(event.params.token)}`);
    return { valid: true as const, inviterName: check.inviterName };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { valid: false as const, message: error.message };
    throw error;
  }
};

export const actions: Actions = {
  join: async (event) => {
    const form = await event.request.formData();
    const email = String(form.get('email') ?? '').trim();
    try {
      await apiFor(event).post(`/api/v1/invitations/${encodeURIComponent(event.params.token)}/accept`, {
        email,
        displayName: String(form.get('displayName') ?? ''),
        password: String(form.get('password') ?? ''),
        emailNotifications: form.get('emailNotifications') === 'on'
      });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return fail(error.status, { error: error.message, fields: error.fields, values: textValues(form) });
    }
    return { sent: true, email };
  },

  resend: async (event) => {
    const form = await event.request.formData();
    const email = String(form.get('email') ?? '').trim();
    try {
      await apiFor(event).post('/api/v1/invitations/resend-confirmation', { email });
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return fail(error.status, { sent: true, email, error: error.message });
    }
    return { sent: true, resent: true, email };
  }
};
