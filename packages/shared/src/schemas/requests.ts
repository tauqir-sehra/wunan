// Requests (003): a member asks for something. Other members answer with an offering linked to it;
// the asker's accepted proposal on a linked offering closes it. Only `kind` and `title` are
// required. Each kind accepts only its own details; anything else is refused with a plain message.
import { z } from 'zod';
import { memberRef, optionalText } from './common.ts';
import { amount, AvailabilityRow, Handover, OfferingType, LoanLengthUnit, pairs, SessionLengthUnit, Unit, wholeNumber } from './offerings.ts';
import { Place, PlaceView } from './places.ts';

export const RequestKind = z.enum(['borrow', 'receive', 'trade', 'service'], {
  message: 'Please choose Borrow, Receive, Trade, or Service.'
});
export type RequestKind = z.infer<typeof RequestKind>;
export const RequestStatus = z.enum(['open', 'closed']);
export const RequestClosedReason = z.enum(['by_asker', 'agreed', 'account_deleted']);

/** The offering type that answers each request kind, and back. The only place this is spelled out. */
export const offeringTypeFor = { borrow: 'lend', receive: 'gift', trade: 'trade', service: 'service' } as const satisfies Record<
  RequestKind,
  OfferingType
>;
export const requestKindFor = { lend: 'borrow', gift: 'receive', trade: 'trade', service: 'service' } as const satisfies Record<
  OfferingType,
  RequestKind
>;

const whole = wholeNumber(1, 'Please enter a whole number of 1 or more.');
const date = (message: string) => z.iso.date({ message }).nullish();

/** One thing a Trade asker could give back (FR-005). */
export const GiveBackItem = z.strictObject({
  description: z
    .string({ message: 'Please say what you could give back.' })
    .trim()
    .min(1, 'Please say what you could give back.')
    .max(100, 'Please keep this to 100 characters or fewer.'),
  amount: amount.nullish(),
  unit: Unit.nullish()
});

const shared = {
  title: z
    .string({ message: 'Please add a title.' })
    .trim()
    .min(1, 'Please add a title.')
    .max(100, 'Please keep the title to 100 characters or fewer.'),
  description: optionalText(2000, 'Please keep the description to 2000 characters or fewer.'),
  neededAfter: date('Please choose a date for "Needed after".'),
  neededBy: date('Please choose a date for "Needed by".'),
  area: Place.nullish(),
  handovers: z
    .array(Handover)
    .max(4)
    .transform((values) => [...new Set(values)])
    .optional()
};

const datesInOrder = (value: { neededAfter?: string | null; neededBy?: string | null }, ctx: z.RefinementCtx) => {
  if (value.neededAfter && value.neededBy && value.neededBy < value.neededAfter) {
    const message = '"Needed by" is before "Needed after". Please change one of them.';
    ctx.addIssue({ code: 'custom', path: ['neededBy'], message });
    ctx.addIssue({ code: 'custom', path: ['neededAfter'], message });
  }
};

const giveBackHasUnits = (value: { giveBack?: { amount?: string | null; unit?: string | null }[] }, ctx: z.RefinementCtx) => {
  value.giveBack?.forEach((item, index) => {
    if (item.amount && !item.unit) ctx.addIssue({ code: 'custom', path: ['giveBack', index, 'unit'], message: 'Please choose a unit for the amount.' });
    if (item.unit && !item.amount) ctx.addIssue({ code: 'custom', path: ['giveBack', index, 'amount'], message: 'Please add a number to go with the unit.' });
  });
};

const amountUnit: [string, string, string] = ['amount', 'unit', 'Please choose a unit for the amount.'];

export const BorrowRequest = z
  .strictObject({ ...shared, kind: z.literal('borrow'), loanLength: whole.nullish(), loanLengthUnit: LoanLengthUnit.nullish() })
  .superRefine(pairs([['loanLength', 'loanLengthUnit', 'Please choose hours, days, or weeks.']]))
  .superRefine(datesInOrder);
export const ReceiveRequest = z
  .strictObject({ ...shared, kind: z.literal('receive'), amount: amount.nullish(), unit: Unit.nullish() })
  .superRefine(pairs([amountUnit]))
  .superRefine(datesInOrder);
export const TradeRequest = z
  .strictObject({
    ...shared,
    kind: z.literal('trade'),
    amount: amount.nullish(),
    unit: Unit.nullish(),
    /** Empty means open to talking about what to give back (FR-005). */
    giveBack: z.array(GiveBackItem).max(10, 'Please list at most 10 things.').optional()
  })
  .superRefine(pairs([amountUnit]))
  .superRefine(giveBackHasUnits)
  .superRefine(datesInOrder);
export const ServiceRequest = z
  .strictObject({
    ...shared,
    kind: z.literal('service'),
    sessionLength: whole.nullish(),
    sessionLengthUnit: SessionLengthUnit.nullish(),
    sessions: whole.nullish(),
    availability: z.array(AvailabilityRow).max(14, 'Please list at most 14 times.').optional()
  })
  .superRefine(pairs([['sessionLength', 'sessionLengthUnit', 'Please choose minutes, hours, days, or weeks.']]))
  .superRefine(datesInOrder);

export const CreateRequest = z.discriminatedUnion('kind', [BorrowRequest, ReceiveRequest, TradeRequest, ServiceRequest]);
export type CreateRequest = z.infer<typeof CreateRequest>;

/** Editing: any fields but `kind`. The API merges with the saved request and checks with `CreateRequest`. */
export const UpdateRequest = z
  .record(z.string(), z.unknown())
  .refine((value) => !('kind' in value), { message: "A request's kind can't be changed. You can close it and ask again." });

export const LinkOffering = z.object({ offeringId: z.uuid({ message: 'Please choose one of your offerings.' }) });

export const RequestLink = z.object({
  id: z.string(),
  offering: z.object({ id: z.string(), title: z.string(), type: OfferingType, status: z.string(), owner: memberRef }),
  linkedBy: memberRef.nullable(),
  /** False when the offering is paused, closed, or removed ("No longer available"). */
  available: z.boolean(),
  canRemove: z.boolean()
});
export type RequestLink = z.infer<typeof RequestLink>;

export const RequestFlag = z.object({ id: z.string(), request: z.string(), from: memberRef, createdAt: z.string(), seen: z.boolean() });

export const RequestSummary = z.object({
  id: z.string(),
  kind: RequestKind,
  title: z.string(),
  area: PlaceView.nullable(),
  neededAfter: z.string().nullable(),
  neededBy: z.string().nullable(),
  asker: memberRef,
  status: RequestStatus,
  closedReason: RequestClosedReason.nullable(),
  linkCount: z.number(),
  /** Only on "My requests": issues raised about it that the asker hasn't seen. */
  unseenFlags: z.number().optional(),
  createdAt: z.string()
});
export type RequestSummary = z.infer<typeof RequestSummary>;

export const Request = RequestSummary.extend({
  description: z.string().nullable(),
  handovers: z.array(Handover),
  loanLength: z.number().nullable(),
  loanLengthUnit: LoanLengthUnit.nullable(),
  amount: z.string().nullable(),
  unit: Unit.nullable(),
  giveBack: z.array(z.object({ description: z.string(), amount: z.string().nullable(), unit: Unit.nullable() })),
  sessionLength: z.number().nullable(),
  sessionLengthUnit: SessionLengthUnit.nullable(),
  sessions: z.number().nullable(),
  availability: z.array(z.object({ weekday: z.number(), startTime: z.string(), endTime: z.string() })),
  /** True when "Needed by" is before today, in the community's time zone. */
  datePassed: z.boolean(),
  closedByAgreementId: z.string().nullable(),
  links: z.array(RequestLink),
  canAnswer: z.boolean(),
  canEdit: z.boolean(),
  /** For the asker of a request closed by an agreement: their other open proposals on its linked offerings. */
  myOtherOpenProposals: z.array(z.object({ id: z.string(), offeringTitle: z.string() })).optional(),
  /** Only for the asker. */
  flags: z.array(RequestFlag).optional()
});
export type Request = z.infer<typeof Request>;

export const RequestSearchQuery = z.object({
  q: z.string().trim().max(200).optional(),
  kind: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(',').filter((k): k is RequestKind => RequestKind.safeParse(k).success) : undefined)),
  area: z.string().trim().max(200).optional(),
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
export type RequestSearchQuery = z.infer<typeof RequestSearchQuery>;

export const SuggestionsQuery = z.object({
  kind: RequestKind,
  q: z.string().trim().max(100).default(''),
  area: z.string().trim().max(200).optional()
});
