// Make a proposal on someone else's listing (002 FR-010 to FR-015): every detail optional, with an
// optional first message. If the member already has one open on this listing, they go to it.
import { error, redirect } from '@sveltejs/kit';
import { apiFor, ApiError } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { formValues } from '#lib/listing-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { proposalBody } from '#lib/proposal-form.ts';
import type { Listing } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const listing = await loadOr404(() => apiFor(event).get<Listing>(`/api/v1/listings/${encodeURIComponent(event.params.id)}`));
  if (listing.owner.id === event.locals.member?.id) error(404, "This is your own listing, so you can't make a proposal on it.");
  if (listing.myOpenProposalId) redirect(303, `/proposals/${listing.myOpenProposalId}`);
  return { listing };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    const listing = await api.get<Listing>(`/api/v1/listings/${encodeURIComponent(event.params.id ?? '')}`);
    let created: { id: string };
    try {
      created = await api.post<{ id: string }>(`/api/v1/listings/${encodeURIComponent(listing.id)}/proposals`, proposalBody(formValues(form), listing.type));
    } catch (problem) {
      if (problem instanceof ApiError && problem.code === 'proposal_exists') redirect(303, `/proposals/${String(problem.details.proposalId)}`);
      throw problem;
    }
    redirect(303, `/proposals/${created.id}?made=1`);
  })
};
