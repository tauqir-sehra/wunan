// One conversation: read it (and mark it read), send messages, and agree a time to call.
import { apiFor } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { MessagesPage } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const id = encodeURIComponent(event.params.id);
  const page = await loadOr404(() => api.get<MessagesPage>(`/api/v1/conversations/${id}/messages`));
  await api.post(`/api/v1/conversations/${id}/read`);
  return { conversation: page.conversation, messages: [...page.items].reverse(), hasEarlier: page.nextCursor !== null };
});

const base = (id: string | undefined) => `/api/v1/conversations/${encodeURIComponent(id ?? '')}`;

/** "2026-06-07" + "14:30" → an ISO time, read in the server's (community's) time zone. */
function localDateTime(date: string | undefined, time: string | undefined): string {
  if (!date || !time) return '';
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}

export const actions: Actions = {
  send: formAction(async ({ event, form, api }) => {
    await api.post(`${base(event.params.id)}/messages`, { body: String(form.get('body') ?? '') });
    return { sent: true };
  }),
  proposeCall: formAction(async ({ event, form, api }) => {
    await api.post(`${base(event.params.id)}/calls`, { proposedTime: localDateTime(text(form, 'date'), text(form, 'time')) });
    return { proposed: true };
  }),
  acceptCall: formAction(async ({ event, form, api }) => {
    await api.post(`${base(event.params.id)}/calls/${encodeURIComponent(String(form.get('messageId') ?? ''))}/accept`);
    return { accepted: true };
  })
};
