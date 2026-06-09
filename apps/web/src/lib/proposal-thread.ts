// The messages that go with a proposal, shared by the proposal page and the agreement made from it:
// loading them (and marking them read), and the actions for sending and accepting a call time.
import type { RequestEvent } from '@sveltejs/kit';
import { formAction, text } from '#lib/form-action.ts';
import type { ContactDetails, MessagesPage } from '@wunan/shared';

import type { Api } from '#lib/api.ts';

/** The latest 50 messages, oldest first, plus what the composer needs. */
export async function loadThread(api: Api, conversationId: string) {
  const [page, contact] = await Promise.all([
    api.get<MessagesPage>(`/api/v1/conversations/${conversationId}/messages`),
    api.get<ContactDetails>('/api/v1/me/contact')
  ]);
  await api.post(`/api/v1/conversations/${conversationId}/read`);
  return {
    contact,
    conversation: page.conversation,
    messages: [...page.items].reverse(),
    hasEarlier: page.nextCursor !== null
  };
}

/** "2026-06-07" + "14:30" → an ISO time, read in the server's (community's) time zone. */
function localDateTime(date: string | undefined, time: string | undefined): string {
  if (!date || !time) return '';
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}

/** The form actions the message box and message list post to; `threadOf` finds the conversation. */
export function threadActions(threadOf: (api: Api, event: RequestEvent) => Promise<string>) {
  const path = async (api: Api, event: RequestEvent) =>
    `/api/v1/conversations/${await threadOf(api, event)}`;
  return {
    // One message: the text plus whatever was added with "+" (contact details, a call time).
    send: formAction(async ({ event, form, api }) => {
      const phone = form.get('phone') === 'yes';
      const email = form.get('email') === 'yes';
      const date = text(form, 'callDate');
      const time = text(form, 'callTime');
      await api.post(`${await path(api, event)}/messages`, {
        body: String(form.get('body') ?? ''),
        ...(phone || email ? { contact: { phone, email } } : {}),
        // Half a time is sent as nothing, so the API asks for the day and the time.
        ...(date || time ? { proposedTime: localDateTime(date, time) } : {})
      });
      return { sent: true };
    }),
    acceptCall: formAction(async ({ event, form, api }) => {
      await api.post(
        `${await path(api, event)}/calls/${encodeURIComponent(String(form.get('messageId') ?? ''))}/accept`
      );
      return { callAccepted: true };
    })
  };
}
