// Turns listing form fields (all text) into the API's listing body for one type.
// Empty boxes are left out, so only what the member filled in is sent.
import type { ListingType } from '@wunan/shared';

const fieldsByType: Record<ListingType, string[]> = {
  lend: ['amount', 'unit', 'loanLength', 'loanLengthUnit'],
  gift: ['amount', 'unit'],
  trade: ['amount', 'unit', 'wanted', 'wantedAmount', 'wantedUnit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessionsAvailable']
};

/** Every field name a listing form can carry (used to keep them across steps). */
export const LISTING_FIELDS = ['type', 'title', 'description', 'area', 'openToOffers', ...new Set(Object.values(fieldsByType).flat())];

export function listingBody(values: Record<string, string>, { forEdit = false } = {}) {
  const type = values.type as ListingType;
  const body: Record<string, unknown> = forEdit ? {} : { type };
  for (const name of ['title', 'description', 'area', ...(fieldsByType[type] ?? [])]) {
    const value = values[name]?.trim() ?? '';
    // When editing, an emptied box clears the saved value; when creating, it's just left out.
    if (value !== '') body[name] = value;
    else if (forEdit && name !== 'title') body[name] = null;
  }
  // A unit picked without a number (or a number without a unit) is checked by the API.
  for (const [numberField, unitField] of [['amount', 'unit'], ['loanLength', 'loanLengthUnit'], ['wantedAmount', 'wantedUnit'], ['sessionLength', 'sessionLengthUnit']] as const) {
    if (!(numberField in body) || body[numberField] === null) {
      if (forEdit && unitField in body) body[unitField] = null;
      else delete body[unitField];
    }
  }
  if (type === 'trade') body.openToOffers = values.openToOffers === 'on';
  if (forEdit) delete body.type;
  return body;
}

/** Reads every text field of a form into a plain object. */
export function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form) if (typeof value === 'string') values[name] = value;
  return values;
}
