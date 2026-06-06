// Share chosen contact details in a conversation, after seeing exactly what will be shown (FR-019).
import { fail, redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { ContactDetails, MessagesPage } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const [page, contact] = await Promise.all([
    loadOr404(() =>
      api.get<MessagesPage>(
        `/api/v1/conversations/${encodeURIComponent(event.params.id)}/messages?limit=1`
      )
    ),
    api.get<ContactDetails>('/api/v1/me/contact')
  ]);
  // Back to where the member came from: the proposal's page, or this thread.
  const back = page.conversation.proposalId
    ? `/proposals/${page.conversation.proposalId}`
    : `/threads/${event.params.id}`;
  return { conversation: page.conversation, contact, back };
});

export const actions: Actions = {
  // Step 1: choose. Shows a preview of exactly what will be shared.
  review: async ({ request }) => {
    const form = await request.formData();
    const choice = { phone: form.get('phone') === 'on', email: form.get('email') === 'on' };
    if (!choice.phone && !choice.email) return fail(400, { error: 'Please choose what to share.' });
    return { review: choice };
  },
  // Step 2: confirm.
  share: formAction(async ({ event, form, api }) => {
    await api.post(
      `/api/v1/conversations/${encodeURIComponent(event.params.id ?? '')}/contact-share`,
      {
        phone: form.get('phone') === 'yes',
        email: form.get('email') === 'yes'
      }
    );
    const page = await api.get<MessagesPage>(
      `/api/v1/conversations/${encodeURIComponent(event.params.id ?? '')}/messages?limit=1`
    );
    redirect(
      303,
      page.conversation.proposalId
        ? `/proposals/${page.conversation.proposalId}#messages`
        : `/threads/${event.params.id}#messages`
    );
  })
};
