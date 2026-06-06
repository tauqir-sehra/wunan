// The public thread on a request or an offering page (003 FR-023): loading it, and the form actions
// for posting, removing your own message (asked first), and raising an issue about someone's.
// Both pages use these, so the thread behaves the same everywhere.
import type { RequestEvent } from '@sveltejs/kit';
import type { PublicThread } from '@wunan/shared';
import { apiFor } from './api.ts';
import { formAction, text } from './form-action.ts';

type Kind = 'requests' | 'offerings';

export async function loadThread(event: RequestEvent, kind: Kind, id: string) {
  const before = event.url.searchParams.get('before');
  const query = before ? `?before=${encodeURIComponent(before)}` : '';
  return apiFor(event).get<PublicThread>(`/api/v1/${kind}/${encodeURIComponent(id)}/messages${query}`);
}

export function threadActions(kind: Kind) {
  return {
    post: formAction(async ({ event, form, api }) => {
      await api.post(`/api/v1/${kind}/${encodeURIComponent(event.params.id ?? '')}/messages`, { body: String(form.get('body') ?? '') });
      return { done: 'post' };
    }),
    removeMessage: formAction(async ({ form, api }) => {
      const messageId = text(form, 'messageId') ?? '';
      if (form.get('confirmed') !== 'yes') return { confirmRemoveMessage: messageId };
      await api.delete(`/api/v1/public-messages/${encodeURIComponent(messageId)}`);
      return { done: 'removeMessage' };
    }),
    flagMessage: formAction(async ({ form, api }) => {
      await api.post(`/api/v1/public-messages/${encodeURIComponent(text(form, 'messageId') ?? '')}/flags`, { request: text(form, 'request') ?? '' });
      return { done: 'flagMessage' };
    })
  };
}
