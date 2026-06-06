// Turns proposal form fields (all text) into the API's proposal body (002 FR-011 to FR-015).
// Every detail is optional. When making a proposal, empty boxes are left out; when changing one,
// an emptied box clears that detail. The chosen accepted things arrive as JSON from ProposalFields.
import type { ListingType } from '@wunan/shared';
import { placeValue } from './listing-form.ts';

const byType: Record<ListingType, string[]> = {
  lend: ['loanLength', 'loanLengthUnit'],
  gift: ['amount'],
  trade: ['amount', 'ownOffer', 'ownOfferAmount', 'ownOfferUnit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessions']
};

export function proposalBody(values: Record<string, string>, type: ListingType, { forEdit = false } = {}) {
  const body: Record<string, unknown> = {};
  for (const name of ['date', 'time', 'handover', ...byType[type]]) {
    const value = values[name]?.trim() ?? '';
    if (value !== '') body[name] = value;
    else if (forEdit) body[name] = null;
  }
  // A unit without its number (or the other way round) is checked by the API; an empty pair is left out.
  for (const [n, u] of [['loanLength', 'loanLengthUnit'], ['sessionLength', 'sessionLengthUnit'], ['ownOfferAmount', 'ownOfferUnit']] as const) {
    if (body[n] == null && body[u] != null && !forEdit) delete body[u];
    if (body[n] == null && forEdit) body[u] = null;
  }
  // No place for these: it's the lister's area, or there's nowhere to go.
  if (values.handover === 'at_lister' || values.handover === 'online') {
    if (forEdit) body.place = null;
  } else {
    const place = placeValue(values, 'place');
    if (place !== undefined) body.place = place;
    else if (forEdit) body.place = null;
  }
  if (type === 'trade' && values.offers) {
    try {
      const offers = JSON.parse(values.offers) as unknown[];
      if (offers.length > 0 || forEdit) body.offers = offers;
    } catch {
      // A broken hidden field just means nothing was chosen.
    }
  }
  if (!forEdit && values.message?.trim()) body.message = values.message.trim();
  return body;
}
