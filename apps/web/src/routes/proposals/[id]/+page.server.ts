// One proposal (002 FR-016 to FR-025): its details and what still blocks it at the top, then its
// messages. The lister accepts or declines; the requester changes details or withdraws. Messages,
// call times, and contact sharing work as they did in conversations.
import { redirect } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import { formAction, text } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { loadThread, threadActions } from '#lib/proposal-thread.ts';
import type { Proposal } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const proposal = await loadOr404(() =>
    api.get<Proposal>(`/api/v1/proposals/${encodeURIComponent(event.params.id)}`)
  );
  return { proposal, ...(await loadThread(api, proposal.conversationId)) };
});

const proposalPath = (id: string | undefined) =>
  `/api/v1/proposals/${encodeURIComponent(id ?? '')}`;
export const actions: Actions = {
  accept: formAction(async ({ event, form, api }) => {
    try {
      const { agreementId } = await api.post<{ agreementId: string }>(
        `${proposalPath(event.params.id)}/accept`,
        { version: Number(form.get('version')) }
      );
      redirect(303, `/agreements/${agreementId}?accepted=1`);
    } catch (problem) {
      // The details changed while the lister was reading: show the new ones and ask again.
      if (problem instanceof ApiError && problem.code === 'proposal_changed')
        return { changed: problem.message };
      throw problem;
    }
  }),
  // Declining and withdrawing ask first; the second press (with `confirmed`) does it.
  decline: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirm: 'decline' };
    await api.post(`${proposalPath(event.params.id)}/decline`, {
      note: text(form, 'note') ?? null
    });
    return { done: 'declined' };
  }),
  withdraw: formAction(async ({ event, form, api }) => {
    if (form.get('confirmed') !== 'yes') return { confirm: 'withdraw' };
    await api.post(`${proposalPath(event.params.id)}/withdraw`, {
      note: text(form, 'note') ?? null
    });
    return { done: 'withdrawn' };
  }),
  ...threadActions(
    async (api, event) => (await api.get<Proposal>(proposalPath(event.params.id))).conversationId
  )
};
