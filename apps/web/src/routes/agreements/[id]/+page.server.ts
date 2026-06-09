// One agreement, made when a proposal was accepted (002 FR-018): what was agreed, the messages from
// the proposal (which carry on here), and for loans, marking it returned (owner).
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { loadThread, threadActions } from '#lib/proposal-thread.ts';
import type { Agreement, Proposal } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

const agreementPath = (id: string | undefined) =>
  `/api/v1/agreements/${encodeURIComponent(id ?? '')}`;

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const agreement = await loadOr404(() => api.get<Agreement>(agreementPath(event.params.id)));
  // Mediators see what was agreed, never the private messages.
  if (agreement.myRole === 'mediator') return { agreement, thread: null };
  const proposal = await api.get<Proposal>(`/api/v1/proposals/${agreement.proposalId}`);
  return {
    agreement,
    conversationId: proposal.conversationId,
    thread: await loadThread(api, proposal.conversationId)
  };
});

export const actions: Actions = {
  returned: formAction(async ({ event, api }) => {
    await api.post(`${agreementPath(event.params.id)}/returned`);
    return { done: 'returned' };
  }),
  ...threadActions(async (api, event) => {
    const { proposalId } = await api.get<Agreement>(agreementPath(event.params.id));
    return (await api.get<Proposal>(`/api/v1/proposals/${proposalId}`)).conversationId;
  })
};
