// Turns listing form fields (all text) into the API's listing body for one type.
// Empty boxes are left out, so only what the member filled in is sent. Handovers, what a trade
// accepts, and when a service is offered arrive as JSON (ListingFields); places arrive as JSON from
// PlaceField, or as plain text in `<name>_text` when JavaScript is off.
import type { Listing, ListingType } from '@wunan/shared';

const fieldsByType: Record<ListingType, string[]> = {
  lend: ['amount', 'unit', 'loanLength', 'loanLengthUnit'],
  gift: ['amount', 'unit'],
  trade: ['amount', 'unit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessionsAvailable']
};
const jsonByType: Record<ListingType, string[]> = { lend: [], gift: [], trade: ['accepts'], service: ['availability'] };

/** Every field name a listing form can carry (used to keep them across steps). */
export const LISTING_FIELDS = [
  'type',
  'title',
  'description',
  'handovers',
  'accepts',
  'availability',
  'area',
  'area_text',
  'meetingPlace',
  'meetingPlace_text',
  ...new Set(Object.values(fieldsByType).flat())
];

const parseJson = (text: string | undefined) => {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

/** A place from PlaceField: its JSON, else the typed text, else nothing. */
export function placeValue(values: Record<string, string>, name: string): unknown {
  return parseJson(values[name]) ?? (values[`${name}_text`]?.trim() || undefined);
}

export function listingBody(values: Record<string, string>, { forEdit = false } = {}) {
  const type = values.type as ListingType;
  const body: Record<string, unknown> = forEdit ? {} : { type };
  for (const name of ['title', 'description', ...(fieldsByType[type] ?? [])]) {
    const value = values[name]?.trim() ?? '';
    // When editing, an emptied box clears the saved value; when creating, it's just left out.
    if (value !== '') body[name] = value;
    else if (forEdit && name !== 'title') body[name] = null;
  }
  // A unit picked without a number (or a number without a unit) is checked by the API.
  for (const [numberField, unitField] of [['amount', 'unit'], ['loanLength', 'loanLengthUnit'], ['sessionLength', 'sessionLengthUnit']] as const) {
    if (!(numberField in body) || body[numberField] === null) {
      if (forEdit && unitField in body) body[unitField] = null;
      else delete body[unitField];
    }
  }
  for (const name of ['handovers', ...(jsonByType[type] ?? [])]) {
    const parsed = parseJson(values[name]);
    if (parsed !== undefined) body[name] = parsed;
  }
  for (const name of ['area', 'meetingPlace']) {
    const place = placeValue(values, name);
    if (place !== undefined) body[name] = place;
    else if (forEdit && (name in values || `${name}_text` in values)) body[name] = null;
  }
  if (forEdit) delete body.type;
  return body;
}

/** A saved listing as form values, for the edit page. */
export function listingValues(listing: Listing): Record<string, string> {
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    type: listing.type,
    title: listing.title,
    description: text(listing.description),
    amount: text(listing.amount),
    unit: text(listing.unit),
    loanLength: text(listing.loanLength),
    loanLengthUnit: text(listing.loanLengthUnit),
    sessionLength: text(listing.sessionLength),
    sessionLengthUnit: text(listing.sessionLengthUnit),
    sessionsAvailable: text(listing.sessionsAvailable),
    handovers: JSON.stringify(listing.handovers),
    accepts: JSON.stringify(listing.accepts),
    availability: JSON.stringify(listing.availability),
    area: listing.area ? JSON.stringify(listing.area) : '',
    meetingPlace: listing.meetingPlace ? JSON.stringify(listing.meetingPlace) : ''
  };
}

/** Reads every text field of a form into a plain object. */
export function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form) if (typeof value === 'string') values[name] = value;
  return values;
}
