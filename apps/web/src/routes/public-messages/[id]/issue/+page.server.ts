// Raise an issue about a public message with its author, as a page of its own: what the pop-up
// does when JavaScript is off (003 FR-023c). The message itself never changes.
import { redirect } from '@sveltejs/kit';
import { formAction, text } from '#lib/form-action.ts';
import type { Actions } from './$types';

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/public-messages/${encodeURIComponent(event.params.id ?? '')}/flags`, { request: text(form, 'request') ?? '' });
    const back = text(form, 'back');
    redirect(303, back?.startsWith('/') && !back.startsWith('//') ? `${back}?messageIssue=sent#public-messages` : '/requests');
  })
};
