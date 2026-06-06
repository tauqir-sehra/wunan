// One proposal (002 FR-016 to FR-025): its details and what still blocks it at the top, then its
// messages. The lister accepts or declines; the requester changes details or withdraws. Messages,
// call times, and contact sharing work as they did in conversations.
import { redirect } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import type { MessagesPage, Proposal } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const proposal = await loadOr404(() => api.get<Proposal>(`/api/v1/proposals/${encodeURIComponent(event.params.id)}`));
  const page = await api.get<MessagesPage>(`/api/v1/conversations/${proposal.conversationId}/messages`);
  await api.post(`/api/v1/conversations/${proposal.conversationId}/read`);
  return { proposal, conversation: page.conversation, messages: [...page.items].reverse(), hasEarlier: page.nextCursor !== null };
});

const proposalPath = (id: string | undefined) => `/api/v1/proposals/${encodeURIComponent(id ?? '')}`;
const threadOf = async (api: ReturnType<typeof apiFor>, id: string | undefined) => (await api.get<Proposal>(proposalPath(id))).conversationId;

/** "2026-06-07" + "14:30" → an ISO time, read in the server's (community's) time zone. */
function localDateTime(date: string | undefined, time: string | undefined): string {
  if (!date || !time) return '';
  const value = new Date(`${date}T${time}`);
  return Number.isNaN(value.getTime()) ? '' : value.toISOString();
}

export const actions: Actions = {
  accept: formAction(async ({ event, form, api }) => {
    try {
      const { agreementId } = await api.post<{ agreementId: string }>(`${proposalPath(event.params.id)}/accept`, { version: Number(form.get('version')) });
      redirect(303, `/agreements/${agreementId}?accepted=1`);
    } catch (problem) {
      // The details changed while the lister was reading: show the new ones and ask again.
      if (problem instanceof ApiError && problem.code === 'proposal_changed') return { changed: problem.message };
      throw problem;
    }
  }),
  // Declining and withdrawing ask first; the second press (with `confirmed`) does it.
  decline: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirm: 'decline' };
    await api.post(`${proposalPath(event.params.id)}/decline`, { note: text(form, 'note') ?? null });
    return { done: 'declined' };
  }),
  withdraw: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirm: 'withdraw' };
    await api.post(`${proposalPath(event.params.id)}/withdraw`, { note: text(form, 'note') ?? null });
    return { done: 'withdrawn' };
  }),
  send: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/conversations/${await threadOf(api, event.params.id)}/messages`, { body: String(form.get('body') ?? '') });
    return { sent: true };
  }),
  proposeCall: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/conversations/${await threadOf(api, event.params.id)}/calls`, { proposedTime: localDateTime(text(form, 'date'), text(form, 'time')) });
    return { proposed: true };
  }),
  acceptCall: formAction(async ({ event, form, api }) => {
    await api.post(`/api/v1/conversations/${await threadOf(api, event.params.id)}/calls/${encodeURIComponent(String(form.get('messageId') ?? ''))}/accept`);
    return { callAccepted: true };
  })
};

