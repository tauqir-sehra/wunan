// Suggest a time to call, as a page of its own: what the "Suggest a call" pop-up does when
// JavaScript is off. Afterwards it goes back to the proposal or thread.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { MessagesPage } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

const backTo = (page: MessagesPage, id: string) =>
  page.conversation.proposalId ? `/proposals/${page.conversation.proposalId}` : `/threads/${id}`;

export const load: PageServerLoad = memberLoad(async (event) => {
  const page = await loadOr404(() =>
    apiFor(event).get<MessagesPage>(
      `/api/v1/conversations/${encodeURIComponent(event.params.id)}/messages?limit=1`
    )
  );
  return { conversation: page.conversation, back: backTo(page, event.params.id) };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    const id = encodeURIComponent(event.params.id ?? '');
    const date = text(form, 'date');
    const time = text(form, 'time');
    const when = date && time ? new Date(`${date}T${time}`) : null;
    await api.post(`/api/v1/conversations/${id}/calls`, {
      proposedTime: when && !Number.isNaN(when.getTime()) ? when.toISOString() : ''
    });
    redirect(
      303,
      `${backTo(await api.get<MessagesPage>(`/api/v1/conversations/${id}/messages?limit=1`), event.params.id ?? '')}#messages`
    );
  })
};
