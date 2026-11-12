// One thread: the shared conversation of a request for help, or (read-only, for helpers) the
// messages of a proposal someone shared with them. Members of a proposal use the proposal's page.
import { redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { threadActions } from '#lib/arrangement-thread.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { ContactDetails, MessagesPage } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const id = encodeURIComponent(event.params.id);
  const page = await loadOr404(() => api.get<MessagesPage>(`/api/v1/conversations/${id}/messages`));
  // An arrangement's own conversation lives on its page.
  if (page.conversation.arrangementId) redirect(303, `/arrangements/${page.conversation.arrangementId}#messages`);
  if (page.conversation.canWrite) await api.post(`/api/v1/conversations/${id}/read`);
  const contact = page.conversation.canWrite
    ? await api.get<ContactDetails>('/api/v1/me/contact')
    : { sharePhone: null, shareEmail: null };
  return {
    contact,
    conversation: page.conversation,
    messages: [...page.items].reverse(),
    hasEarlier: page.nextCursor !== null
  };
});

export const actions: Actions = threadActions(async (_api, event) => event.params.id ?? '');
