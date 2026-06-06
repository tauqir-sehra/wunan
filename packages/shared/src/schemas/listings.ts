// Listings (001 FR-007 to FR-014; 002 FR-001 to FR-009): what a member offers, per type. Only
// `type` and `title` are required. Each type accepts only its own fields; anything else is refused
// with a plain message.
import { z } from 'zod';
import { memberRef } from './common.ts';
import { Place, PlaceView } from './places.ts';

export const ListingType = z.enum(['lend', 'gift', 'trade', 'service'], {
  message: 'Please choose Lend, Gift, Trade, or Service.'
});
export type ListingType = z.infer<typeof ListingType>;

export const Unit = z.enum(['item', 'kg', 'g', 'lb', 'oz', 'litre', 'hour', 'portion', 'bag', 'box', 'other'], {
  message: 'Please choose a unit from the list.'
});
export type Unit = z.infer<typeof Unit>;
export const LoanLengthUnit = z.enum(['hours', 'days', 'weeks'], { message: 'Please choose hours, days, or weeks.' });
export const SessionLengthUnit = z.enum(['minutes', 'hours', 'days', 'weeks'], {
  message: 'Please choose minutes, hours, days, or weeks.'
});
export type SessionLengthUnit = z.infer<typeof SessionLengthUnit>;
export const ListingStatus = z.enum(['available', 'paused', 'closed']);

/**
 * How the handover happens (002 research §6). One set of values for every type; the words shown
 * depend on the type (e.g. `at_lister` is "Picked up from Sam" for a lend, "At Sam's" for a service).
 */
export const Handover = z.enum(['to_requester', 'at_lister', 'elsewhere', 'online'], {
  message: 'Please choose one of the ways listed.'
});
export type Handover = z.infer<typeof Handover>;

/** A positive decimal amount, accepted as a number or text ("2.5"), returned as text. */
export const amount = z
  .union([z.number(), z.string().trim()])
  .transform((value) => String(value).replace(',', '.'))
  .refine((value) => /^\d{1,9}(\.\d{1,3})?$/.test(value) && Number(value) > 0, {
    message: 'Please enter a number above 0, like 2 or 2.5.'
  });

export const wholeNumber = (min: number, message: string) =>
  z.union([z.number(), z.string().trim()]).transform((value, ctx) => {
    const number = Number(value);
    if (!Number.isInteger(number) || number < min) {
      ctx.addIssue({ code: 'custom', message });
      return z.NEVER;
    }
    return number;
  });

const text = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .transform((value) => (value === '' ? null : value));

const shared = {
  title: z
    .string({ message: 'Please add a title.' })
    .trim()
    .min(1, 'Please add a title.')
    .max(100, 'Please keep the title to 100 characters or fewer.'),
  description: text(2000, 'Please keep the description to 2000 characters or fewer.').nullish(),
  area: Place.nullish(),
  meetingPlace: Place.nullish(),
  handovers: z
    .array(Handover)
    .max(4)
    .transform((values) => [...new Set(values)])
    .optional()
};

/** One thing a Trade listing accepts in return (002 FR-005). */
export const TradeAccept = z.strictObject({
  description: z
    .string({ message: 'Please say what you would accept.' })
    .trim()
    .min(1, 'Please say what you would accept.')
    .max(100, 'Please keep this to 100 characters or fewer.'),
  amount: amount.nullish(),
  unit: Unit.nullish()
});

/** "HH:MM", 24-hour. */
const clockTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter a time like 18:00.');

/** A weekly time a Service is offered, in the community's time zone (002 FR-009). */
export const AvailabilityRow = z
  .strictObject({
    weekday: wholeNumber(1, 'Please choose a day.').refine((day) => day <= 7, 'Please choose a day.'),
    startTime: clockTime,
    endTime: clockTime
  })
  .refine((row) => row.startTime < row.endTime, { path: ['endTime'], message: 'Please choose an end time after the start time.' });

const withAmount = {
  amount: amount.nullish(),
  unit: Unit.nullish()
};

/** Numbers that need a unit (and units that need a number) are checked together. */
function pairs(entries: [string, string, string][]) {
  return (value: Record<string, unknown>, ctx: z.RefinementCtx) => {
    for (const [numberField, unitField, message] of entries) {
      const hasNumber = value[numberField] !== null && value[numberField] !== undefined;
      const hasUnit = value[unitField] !== null && value[unitField] !== undefined;
      if (hasNumber && !hasUnit) ctx.addIssue({ code: 'custom', path: [unitField], message });
      if (hasUnit && !hasNumber) ctx.addIssue({ code: 'custom', path: [numberField], message: 'Please add a number to go with the unit.' });
    }
  };
}

const LendFields = z.strictObject({
  ...shared,
  ...withAmount,
  loanLength: wholeNumber(1, 'Please enter a whole number of 1 or more.').nullish(),
  loanLengthUnit: LoanLengthUnit.nullish()
});
const GiftFields = z.strictObject({ ...shared, ...withAmount });
const TradeFields = z.strictObject({
  ...shared,
  ...withAmount,
  /** Empty means open to offers (002 FR-006). */
  accepts: z.array(TradeAccept).max(10, 'Please list at most 10 things.').optional()
});
const ServiceFields = z.strictObject({
  ...shared,
  sessionLength: wholeNumber(1, 'Please enter a whole number of 1 or more.').nullish(),
  sessionLengthUnit: SessionLengthUnit.nullish(),
  sessionsAvailable: wholeNumber(1, 'Please enter a whole number of 1 or more.').nullish(),
  availability: z.array(AvailabilityRow).max(14, 'Please list at most 14 times.').optional()
});

/** A place is needed for the handovers that happen at one (002 FR-004). */
const placesForHandovers = (
  value: { handovers?: Handover[]; area?: unknown; meetingPlace?: unknown },
  ctx: z.RefinementCtx
) => {
  if (value.handovers?.includes('at_lister') && !value.area) {
    ctx.addIssue({ code: 'custom', path: ['area'], message: 'Please add your area so people know roughly where it is.' });
  }
  if (value.handovers?.includes('elsewhere') && !value.meetingPlace) {
    ctx.addIssue({ code: 'custom', path: ['meetingPlace'], message: 'Please add the place to meet.' });
  }
};

const acceptsHaveUnits = (value: { accepts?: { amount?: string | null; unit?: string | null }[] }, ctx: z.RefinementCtx) => {
  value.accepts?.forEach((item, index) => {
    if (item.amount && !item.unit) ctx.addIssue({ code: 'custom', path: ['accepts', index, 'unit'], message: 'Please choose a unit for the amount.' });
    if (item.unit && !item.amount) ctx.addIssue({ code: 'custom', path: ['accepts', index, 'amount'], message: 'Please add a number to go with the unit.' });
  });
};

const amountUnit: [string, string, string] = ['amount', 'unit', 'Please choose a unit for the amount.'];

export const LendListing = LendFields.extend({ type: z.literal('lend') })
  .superRefine(pairs([amountUnit, ['loanLength', 'loanLengthUnit', 'Please choose hours, days, or weeks.']]))
  .superRefine(placesForHandovers);
export const GiftListing = GiftFields.extend({ type: z.literal('gift') }).superRefine(pairs([amountUnit])).superRefine(placesForHandovers);
export const TradeListing = TradeFields.extend({ type: z.literal('trade') })
  .superRefine(pairs([amountUnit]))
  .superRefine(acceptsHaveUnits)
  .superRefine(placesForHandovers);
export const ServiceListing = ServiceFields.extend({ type: z.literal('service') })
  .superRefine(pairs([['sessionLength', 'sessionLengthUnit', 'Please choose minutes, hours, days, or weeks.']]))
  .superRefine(placesForHandovers);

export const CreateListing = z.discriminatedUnion('type', [LendListing, GiftListing, TradeListing, ServiceListing]);
export type CreateListing = z.infer<typeof CreateListing>;

/**
 * Editing: any of the fields, but never `type`. The API merges the changes with the saved listing
 * and checks the result with `CreateListing`, so the per-type rules always apply.
 */
export const UpdateListing = z
  .record(z.string(), z.unknown())
  .refine((value) => !('type' in value), { message: "A listing's type can't be changed. You can remove it and create a new one." });

export const ListingPhoto = z.object({
  id: z.string(),
  key: z.string(),
  url: z.string(),
  alt: z.string().nullable(),
  position: z.number()
});

export const ListingFlag = z.object({
  id: z.string(),
  request: z.string(),
  from: memberRef,
  createdAt: z.string(),
  seen: z.boolean()
});

export const Listing = z.object({
  id: z.string(),
  type: ListingType,
  title: z.string(),
  description: z.string().nullable(),
  amount: z.string().nullable(),
  unit: Unit.nullable(),
  remaining: z.string().nullable(),
  loanLength: z.number().nullable(),
  loanLengthUnit: LoanLengthUnit.nullable(),
  accepts: z.array(TradeAccept.extend({ id: z.string(), amount: z.string().nullable(), unit: Unit.nullable() })),
  sessionLength: z.number().nullable(),
  sessionLengthUnit: SessionLengthUnit.nullable(),
  sessionsAvailable: z.number().nullable(),
  sessionsRemaining: z.number().nullable(),
  availability: z.array(z.object({ weekday: z.number(), startTime: z.string(), endTime: z.string() })),
  handovers: z.array(Handover),
  /** In full for the owner and members with an accepted proposal on it; otherwise `{ display }`. */
  area: PlaceView.nullable(),
  meetingPlace: PlaceView.nullable(),
  status: ListingStatus,
  /** Lend: a loan is in progress and not yet marked returned (002 FR-019a). */
  lentOut: z.boolean(),
  /** Lend: loans already accepted that haven't ended, so requesters can pick free dates. */
  takenPeriods: z.array(z.object({ startsAt: z.string(), endsAt: z.string(), overdue: z.boolean() })),
  /** The caller's own open proposal on this listing, if any. */
  myOpenProposalId: z.string().nullable(),
  closedReason: z.enum(['removed', 'used_up']).nullable(),
  createdAt: z.string(),
  owner: memberRef.extend({ invitedBy: memberRef.nullable() }),
  photos: z.array(ListingPhoto),
  /** Present only for the owner. */
  flags: z.array(ListingFlag).optional(),
  openProposalCount: z.number().optional()
});
export type Listing = z.infer<typeof Listing>;

export const MyListing = Listing.omit({ flags: true }).extend({ unseenFlags: z.number() });
export type MyListing = z.infer<typeof MyListing>;

export const CreateFlag = z.object({
  request: z
    .string({ message: 'Please write your request.' })
    .trim()
    .min(1, 'Please write your request.')
    .max(500, 'Please keep your request to 500 characters or fewer.')
});

export const UpdatePhoto = z.object({
  alt: text(200, 'Please keep the description to 200 characters or fewer.').nullish(),
  position: z.number().int().min(0).max(5).optional()
});
