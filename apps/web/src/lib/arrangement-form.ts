// Turns proposal form fields (all text) into the API's proposal body (002 FR-011 to FR-015).
// Every detail is optional. When making a proposal, empty boxes are left out; when changing one,
// an emptied box clears that detail. The chosen accepted things arrive as JSON from ArrangementFields.
// The requester changes one detail at a time on the arrangement page (006): `detailBody` sends only
// that detail's keys, so the API leaves the others as they are.
import type { Arrangement, OfferingType } from '@wunan/shared';
import { placeValue } from './offering-form.ts';

/** One detail row on the arrangement page, as named in its `?detail=` address (006 data-model.md). */
export type DetailKey =
  'when' | 'how' | 'where' | 'length' | 'amount' | 'return' | 'session' | 'sessions';

/** The API keys each detail row saves (006 research §2). */
export const detailKeys: Record<DetailKey, string[]> = {
  when: ['date', 'time'],
  how: ['handover'],
  where: ['place'],
  length: ['loanLength', 'loanLengthUnit'],
  amount: ['amount'],
  return: ['offers', 'ownOffer', 'ownOfferAmount', 'ownOfferUnit'],
  session: ['sessionLength', 'sessionLengthUnit'],
  sessions: ['sessions']
};

/**
 * The rows the viewer can open, in the order the page lists them: only for the requester while
 * it's open (`canEdit`), and "Where" only when the requester picks the place (not online, and not
 * at the lister's own place).
 */
export function pressableDetails(arrangement: Arrangement): DetailKey[] {
  if (!arrangement.canEdit) return [];
  const d = arrangement.details;
  const type = arrangement.offering.type;
  const keys: DetailKey[] = ['when', 'how'];
  if (d.handover !== 'online' && d.handover !== 'at_lister') keys.push('where');
  if (type === 'lend') keys.push('length');
  if ((type === 'gift' || type === 'trade') && (d.amount || arrangement.offering.unit))
    keys.push('amount');
  if (type === 'trade') keys.push('return');
  if (type === 'service') keys.push('session', 'sessions');
  return keys;
}

export const isDetailKey = (value: unknown): value is DetailKey =>
  typeof value === 'string' && value in detailKeys;

/** The body for saving one detail: only its keys, with an emptied field clearing it. */
export function detailBody(detail: DetailKey, values: Record<string, string>, type: OfferingType) {
  const all = arrangementBody(values, type, { forEdit: true });
  const body: Record<string, unknown> = {};
  for (const key of detailKeys[detail]) if (key in all) body[key] = all[key];
  // Online, or at the lister's place, has no place of the requester's to keep.
  if (detail === 'how' && (values.handover === 'online' || values.handover === 'at_lister'))
    body.place = null;
  return body;
}

const byType: Record<OfferingType, string[]> = {
  lend: ['loanLength', 'loanLengthUnit'],
  gift: ['amount'],
  trade: ['amount', 'ownOffer', 'ownOfferAmount', 'ownOfferUnit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessions']
};

export function arrangementBody(
  values: Record<string, string>,
  type: OfferingType,
  { forEdit = false } = {}
) {
  const body: Record<string, unknown> = {};
  for (const name of ['date', 'time', 'handover', ...byType[type]]) {
    const value = values[name]?.trim() ?? '';
    if (value !== '') body[name] = value;
    else if (forEdit) body[name] = null;
  }
  // A unit without its number (or the other way round) is checked by the API; an empty pair is left out.
  for (const [n, u] of [
    ['loanLength', 'loanLengthUnit'],
    ['sessionLength', 'sessionLengthUnit'],
    ['ownOfferAmount', 'ownOfferUnit']
  ] as const) {
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

/**
 * An arrangement's details as the form's text values: for changing them, and for asking again
 * with what was asked before (004 FR-010a).
 */
export function detailValues(arrangement: Arrangement): Record<string, string> {
  const d = arrangement.details;
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    date: text(d.date),
    time: text(d.time),
    handover: text(d.handover),
    // The offering's own place isn't saved on the arrangement, so it isn't offered for editing.
    place:
      d.place && 'label' in d.place && d.handover !== 'at_lister' ? JSON.stringify(d.place) : '',
    loanLength: text(d.loanLength),
    loanLengthUnit: text(d.loanLengthUnit),
    amount: text(d.amount),
    offers: JSON.stringify(
      d.offers.map((o) => ({ acceptId: o.acceptId, ...(o.amount ? { amount: o.amount } : {}) }))
    ),
    ownOffer: text(d.ownOffer),
    ownOfferAmount: text(d.ownOfferAmount),
    ownOfferUnit: text(d.ownOfferUnit),
    sessionLength: text(d.sessionLength),
    sessionLengthUnit: text(d.sessionLengthUnit),
    sessions: text(d.sessions)
  };
}
