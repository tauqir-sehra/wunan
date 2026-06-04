// Listings (FR-007 to FR-014): what a member offers, per type. Only `type` and `title` are
// required. Each type accepts only its own fields; anything else is refused with a plain message.
import { z } from 'zod';
import { memberRef } from './common.ts';

export const ListingType = z.enum(['lend', 'gift', 'trade', 'service'], {
  message: 'Please choose Lend, Gift, Trade, or Service.'
});
export type ListingType = z.infer<typeof ListingType>;

export const Unit = z.enum(['item', 'kg', 'g', 'litre', 'hour', 'portion', 'bag', 'box', 'other'], {
  message: 'Please choose a unit from the list.'
});
export type Unit = z.infer<typeof Unit>;
export const LoanLengthUnit = z.enum(['hours', 'days', 'weeks'], { message: 'Please choose hours, days, or weeks.' });
export const SessionLengthUnit = z.enum(['minutes', 'hours'], { message: 'Please choose minutes or hours.' });
export const ListingStatus = z.enum(['available', 'lent_out', 'paused', 'closed']);

/** A positive decimal amount, accepted as a number or text ("2.5"), returned as text. */
const amount = z
  .union([z.number(), z.string().trim()])
  .transform((value) => String(value).replace(',', '.'))
  .refine((value) => /^\d{1,9}(\.\d{1,3})?$/.test(value) && Number(value) > 0, {
    message: 'Please enter a number above 0, like 2 or 2.5.'
  });

const wholeNumber = (min: number, message: string) =>
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
  area: text(60, 'Please keep the area to 60 characters or fewer.').nullish()
};

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
  wanted: text(300, 'Please keep this to 300 characters or fewer.').nullish(),
  wantedAmount: amount.nullish(),
  wantedUnit: Unit.nullish(),
  openToOffers: z.boolean().nullish()
});
const ServiceFields = z.strictObject({
  ...shared,
  sessionLength: wholeNumber(1, 'Please enter a whole number of 1 or more.').nullish(),
  sessionLengthUnit: SessionLengthUnit.nullish(),
  sessionsAvailable: wholeNumber(1, 'Please enter a whole number of 1 or more.').nullish()
});

const tradeWantsSomething = (value: { wanted?: string | null; openToOffers?: boolean | null }, ctx: z.RefinementCtx) => {
  if (!value.wanted && !value.openToOffers) {
    ctx.addIssue({ code: 'custom', path: ['wanted'], message: "Say what you'd like in return, or tick Open to offers." });
  }
};

const amountUnit: [string, string, string] = ['amount', 'unit', 'Please choose a unit for the amount.'];

export const LendListing = LendFields.extend({ type: z.literal('lend') }).superRefine(
  pairs([amountUnit, ['loanLength', 'loanLengthUnit', 'Please choose hours, days, or weeks.']])
);
export const GiftListing = GiftFields.extend({ type: z.literal('gift') }).superRefine(pairs([amountUnit]));
export const TradeListing = TradeFields.extend({ type: z.literal('trade') })
  .superRefine(pairs([amountUnit, ['wantedAmount', 'wantedUnit', 'Please choose a unit for what you would like.']]))
  .superRefine(tradeWantsSomething);
export const ServiceListing = ServiceFields.extend({ type: z.literal('service') }).superRefine(
  pairs([['sessionLength', 'sessionLengthUnit', 'Please choose minutes or hours.']])
);

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
  wanted: z.string().nullable(),
  wantedAmount: z.string().nullable(),
  wantedUnit: Unit.nullable(),
  openToOffers: z.boolean(),
  sessionLength: z.number().nullable(),
  sessionLengthUnit: SessionLengthUnit.nullable(),
  sessionsAvailable: z.number().nullable(),
  sessionsRemaining: z.number().nullable(),
  area: z.string().nullable(),
  status: ListingStatus,
  closedReason: z.enum(['removed', 'used_up']).nullable(),
  createdAt: z.string(),
  owner: memberRef.extend({ invitedBy: memberRef.nullable() }),
  photos: z.array(ListingPhoto),
  /** Present only for the owner. */
  flags: z.array(ListingFlag).optional()
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
