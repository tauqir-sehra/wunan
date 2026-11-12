// Request forms (003): form fields (all text) ↔ the API's request body, and a request turned into a
// starting point for the offering that answers it (FR-012) and for the asker's proposal (FR-017).
// Empty boxes are left out when asking; when editing, an emptied box clears that detail.
import { offeringTypeFor, type Offering, type Request, type RequestKind } from '@wunan/shared';
import { placeValue } from './offering-form.ts';

const fieldsByKind: Record<RequestKind, string[]> = {
  borrow: ['loanLength', 'loanLengthUnit'],
  receive: ['amount', 'unit'],
  trade: ['amount', 'unit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessions']
};
const jsonByKind: Record<RequestKind, string[]> = { borrow: [], receive: [], trade: ['giveBack'], service: ['availability'] };

const parseJson = (text: string | undefined) => {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

export function requestBody(values: Record<string, string>, { forEdit = false } = {}) {
  const kind = values.kind as RequestKind;
  const body: Record<string, unknown> = forEdit ? {} : { kind };
  for (const name of ['title', 'description', 'neededAfter', 'neededBy', ...(fieldsByKind[kind] ?? [])]) {
    const value = values[name]?.trim() ?? '';
    if (value !== '') body[name] = value;
    else if (forEdit && name !== 'title') body[name] = null;
  }
  for (const [numberField, unitField] of [['amount', 'unit'], ['loanLength', 'loanLengthUnit'], ['sessionLength', 'sessionLengthUnit']] as const) {
    if (!(numberField in body) || body[numberField] === null) {
      if (forEdit && unitField in body) body[unitField] = null;
      else delete body[unitField];
    }
  }
  for (const name of ['handovers', ...(jsonByKind[kind] ?? [])]) {
    const parsed = parseJson(values[name]);
    if (parsed !== undefined) body[name] = parsed;
  }
  const area = placeValue(values, 'area');
  if (area !== undefined) body.area = area;
  else if (forEdit && ('area' in values || 'area_text' in values)) body.area = null;
  return body;
}

const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));

/** A saved request as form values, for the edit page. */
export function requestValues(request: Request): Record<string, string> {
  return {
    kind: request.kind,
    title: request.title,
    description: text(request.description),
    neededAfter: text(request.neededAfter),
    neededBy: text(request.neededBy),
    loanLength: text(request.loanLength),
    loanLengthUnit: text(request.loanLengthUnit),
    amount: text(request.amount),
    unit: text(request.unit),
    sessionLength: text(request.sessionLength),
    sessionLengthUnit: text(request.sessionLengthUnit),
    sessions: text(request.sessions),
    handovers: JSON.stringify(request.handovers),
    giveBack: JSON.stringify(request.giveBack),
    availability: JSON.stringify(request.availability),
    area: request.area ? JSON.stringify(request.area) : ''
  };
}

/**
 * The offering form's starting values for answering a request (FR-012): title, description, area,
 * handovers, and per kind the loan length as the longest loan, the amount, what the asker could give
 * back as what the helper would accept, and the session details. The helper can change all of it.
 */
export function offeringPrefillFromRequest(request: Request): Record<string, string> {
  const values: Record<string, string> = {
    type: offeringTypeFor[request.kind],
    title: request.title,
    description: text(request.description),
    handovers: JSON.stringify(request.handovers)
  };
  // Only an area typed as text can be reused; others see a request's area as "neighbourhood, city".
  if (request.area) values.area_text = 'label' in request.area ? request.area.label : request.area.display;
  if (request.kind === 'borrow') Object.assign(values, { loanLength: text(request.loanLength), loanLengthUnit: text(request.loanLengthUnit) });
  if (request.kind === 'receive' || request.kind === 'trade') Object.assign(values, { amount: text(request.amount), unit: text(request.unit) });
  if (request.kind === 'trade') values.accepts = JSON.stringify(request.giveBack);
  if (request.kind === 'service') {
    Object.assign(values, { sessionLength: text(request.sessionLength), sessionLengthUnit: text(request.sessionLengthUnit), sessionsAvailable: text(request.sessions) });
    values.availability = JSON.stringify(request.availability);
  }
  return values;
}

/**
 * The asker's proposal form, filled in from their request (research §3): the "Needed after" date,
 * the first handover the offering offers, the area (for handovers that take a place), and the
 * matching amounts and lengths. Give-back items that match an accepted thing become offers; the rest
 * are written as the asker's own offer. Every value stays changeable.
 */
export function askPrefillFromRequest(request: Request, offering: Offering): Record<string, string> {
  const values: Record<string, string> = {};
  if (request.neededAfter) values.date = request.neededAfter;
  const handover = request.handovers.find((h) => offering.handovers.includes(h));
  if (handover) values.handover = handover;
  if (request.area && handover !== 'at_lister' && handover !== 'online') {
    values.place = JSON.stringify('label' in request.area ? request.area : { label: request.area.display, source: 'typed' });
  }
  if (offering.type === 'lend') Object.assign(values, { loanLength: text(request.loanLength), loanLengthUnit: text(request.loanLengthUnit) });
  if (offering.type === 'gift' || offering.type === 'trade') values.amount = text(request.amount);
  if (offering.type === 'trade') {
    const matched: { acceptId: string; amount?: string }[] = [];
    const rest: string[] = [];
    for (const item of request.giveBack) {
      const accept = offering.accepts.find((a) => a.description.trim().toLowerCase() === item.description.trim().toLowerCase());
      if (accept) matched.push({ acceptId: accept.id, ...(item.amount ? { amount: item.amount } : {}) });
      else rest.push(item.amount ? `${item.description} (${item.amount}${item.unit ? ` ${item.unit}` : ''})` : item.description);
    }
    if (matched.length) values.offers = JSON.stringify(matched);
    if (rest.length) values.ownOffer = rest.join(', ');
  }
  if (offering.type === 'service') Object.assign(values, { sessionLength: text(request.sessionLength), sessionLengthUnit: text(request.sessionLengthUnit), sessions: text(request.sessions) });
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== ''));
}

/** Field names in plain words, for the list of problems above a form. */
export const requestFieldLabels: Record<string, string> = {
  kind: 'What you need',
  title: 'Title',
  description: 'Description',
  neededAfter: 'Needed after',
  neededBy: 'Needed by',
  area: 'Area',
  handovers: 'How it could happen',
  loanLength: 'How long',
  loanLengthUnit: 'How long',
  amount: 'How much',
  unit: 'How much',
  giveBack: 'What you could give back',
  sessionLength: 'How long each time',
  sessionLengthUnit: 'How long each time',
  sessions: 'How many times',
  availability: 'Times that suit you'
};
