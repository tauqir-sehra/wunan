// Make a proposal on someone else's offering (002 FR-010 to FR-015): every detail optional, with an
// optional first message. If the member already has one open on this offering, they go to it.
import { error, redirect } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { formValues } from '#lib/offering-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { proposalBody } from '#lib/proposal-form.ts';
import { proposalPrefillFromRequest } from '#lib/request-form.ts';
import type { Offering, Request } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const offering = await loadOr404(() => apiFor(event).get<Offering>(`/api/v1/offerings/${encodeURIComponent(event.params.id)}`));
  if (offering.owner.id === event.locals.member?.id) error(404, "This is your own offering, so you can't make a proposal on it.");
  if (offering.myOpenProposalId) redirect(303, `/proposals/${offering.myOpenProposalId}`);
  // The asker of a linked request starts from it (003 FR-017); linked to several, they choose first.
  // With none linked but an open request of the matching kind, they're asked whether this is for
  // it (FR-017a); saying yes links the offering to that request when the proposal is sent.
  const linked = offering.myOpenRequestsLinked ?? [];
  const linkable = offering.myLinkableRequests ?? [];
  const asked = event.url.searchParams.get('request');
  const chosenId = linked.length === 1 ? linked[0]!.id : (linked.find((r) => r.id === asked) ?? linkable.find((r) => r.id === asked))?.id;
  const request = chosenId ? await apiFor(event).get<Request>(`/api/v1/requests/${encodeURIComponent(chosenId)}`) : null;
  const askIfForRequest = !request && asked !== 'none' && linked.length === 0 && linkable.length > 0;
  return {
    offering,
    request,
    /** The proposal links the offering to the request first. */
    linkFirst: Boolean(request && !linked.some((r) => r.id === request.id)),
    chooseFrom: !request && linked.length > 1 ? linked : askIfForRequest ? linkable : [],
    askIfForRequest,
    prefill: request ? { ...proposalPrefillFromRequest(request, offering), requestId: request.id } : {}
  };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    const offering = await api.get<Offering>(`/api/v1/offerings/${encodeURIComponent(event.params.id ?? '')}`);
    let created: { id: string };
    const values = formValues(form);
    const body = { ...proposalBody(values, offering.type), ...(values.requestId ? { requestId: values.requestId } : {}) };
    // "Yes, it's for my request": link the offering to it, so accepting closes the request.
    let link: { id: string } | null = null;
    if (values.requestId && values.linkFirst === 'yes') {
      link = await api.post<{ id: string }>(`/api/v1/requests/${encodeURIComponent(values.requestId)}/links`, { offeringId: offering.id });
    }
    try {
      created = await api.post<{ id: string }>(`/api/v1/offerings/${encodeURIComponent(offering.id)}/proposals`, body);
    } catch (problem) {
      // Nothing half-done: the link goes again if the proposal couldn't be made.
      if (link) await api.delete(`/api/v1/requests/${encodeURIComponent(values.requestId!)}/links/${link.id}`).catch(() => undefined);
      if (problem instanceof ApiError && problem.code === 'proposal_exists') redirect(303, `/proposals/${String(problem.details.proposalId)}`);
      throw problem;
    }
    redirect(303, `/proposals/${created.id}?made=1`);
  })
};
