// Turns offering form fields (all text) into the API's offering body for one type.
// Empty boxes are left out, so only what the member filled in is sent. Handovers, what a trade
// accepts, and when a service is offered arrive as JSON (OfferingFields); places arrive as JSON from
// PlaceField, or as plain text in `<name>_text` when JavaScript is off.
import type { Offering, OfferingType } from '@wunan/shared';

const fieldsByType: Record<OfferingType, string[]> = {
  lend: ['amount', 'unit', 'loanLength', 'loanLengthUnit'],
  gift: ['amount', 'unit'],
  trade: ['amount', 'unit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessionsAvailable']
};
const jsonByType: Record<OfferingType, string[]> = { lend: [], gift: [], trade: ['accepts'], service: ['availability'] };

/** Every field name an offering form can carry (used to keep them across steps). */
export const OFFERING_FIELDS = [
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
  'forRequest',
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

export function offeringBody(values: Record<string, string>, { forEdit = false } = {}) {
  const type = values.type as OfferingType;
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
  // Made for a request (003 FR-012): the API links it once it's created.
  if (!forEdit && values.forRequest) body.forRequest = values.forRequest;
  if (forEdit) delete body.type;
  return body;
}

/** A saved offering as form values, for the edit page. */
export function offeringValues(offering: Offering): Record<string, string> {
  const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    type: offering.type,
    title: offering.title,
    description: text(offering.description),
    amount: text(offering.amount),
    unit: text(offering.unit),
    loanLength: text(offering.loanLength),
    loanLengthUnit: text(offering.loanLengthUnit),
    sessionLength: text(offering.sessionLength),
    sessionLengthUnit: text(offering.sessionLengthUnit),
    sessionsAvailable: text(offering.sessionsAvailable),
    handovers: JSON.stringify(offering.handovers),
    accepts: JSON.stringify(offering.accepts),
    availability: JSON.stringify(offering.availability),
    area: offering.area ? JSON.stringify(offering.area) : '',
    meetingPlace: offering.meetingPlace ? JSON.stringify(offering.meetingPlace) : ''
  };
}

/** Reads every text field of a form into a plain object. */
export function formValues(form: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [name, value] of form) if (typeof value === 'string') values[name] = value;
  return values;
}
