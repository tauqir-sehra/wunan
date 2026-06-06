// The requester changes a proposal's details (002 FR-016). Each change is noted in its messages.
import { error, redirect } from '@sveltejs/kit';
import { apiFor } from '#lib/api.ts';
import { formAction } from '#lib/form-action.ts';
import { formValues } from '#lib/listing-form.ts';
import { loadOr404, memberLoad } from '#lib/load.ts';
import { proposalBody } from '#lib/proposal-form.ts';
import type { Listing, Proposal } from '@wunan/shared';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = memberLoad(async (event) => {
  const api = apiFor(event);
  const proposal = await loadOr404(() => api.get<Proposal>(`/api/v1/proposals/${encodeURIComponent(event.params.id)}`));
  if (!proposal.canEdit) error(403, 'Only the person who made the proposal can change it, while it is open.');
  const listing = await api.get<Listing>(`/api/v1/listings/${proposal.listing.id}`);
  const d = proposal.details;
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  const values: Record<string, string> = {
    date: text(d.date),
    time: text(d.time),
    handover: text(d.handover),
    // The listing's own place isn't saved on the proposal, so it isn't offered for editing.
    place: d.place && 'label' in d.place && d.handover !== 'at_lister' ? JSON.stringify(d.place) : '',
    loanLength: text(d.loanLength),
    loanLengthUnit: text(d.loanLengthUnit),
    amount: text(d.amount),
    offers: JSON.stringify(d.offers.map((o) => ({ acceptId: o.acceptId, ...(o.amount ? { amount: o.amount } : {}) }))),
    ownOffer: text(d.ownOffer),
    ownOfferAmount: text(d.ownOfferAmount),
    ownOfferUnit: text(d.ownOfferUnit),
    sessionLength: text(d.sessionLength),
    sessionLengthUnit: text(d.sessionLengthUnit),
    sessions: text(d.sessions)
  };
  return { proposal, listing, values };
});

export const actions: Actions = {
  default: formAction(async ({ event, form, api }) => {
    const proposal = await api.get<Proposal>(`/api/v1/proposals/${encodeURIComponent(event.params.id ?? '')}`);
    await api.patch(`/api/v1/proposals/${proposal.id}`, proposalBody(formValues(form), proposal.listing.type, { forEdit: true }));
    redirect(303, `/proposals/${proposal.id}`);
  })
};
