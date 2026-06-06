// Proposals (002 FR-010 to FR-021): a member asks for something on someone else's listing. Every
// detail is optional until the lister accepts; only the requester changes them, and what the
// proposal says is what the requester has agreed to. Which details apply depends on the listing's
// type; the API refuses details that don't apply, and lists what still blocks acceptance as issues.
import { z } from 'zod';
import { memberRef } from './common.ts';
import { amount, Handover, ListingType, LoanLengthUnit, SessionLengthUnit, Unit, wholeNumber } from './listings.ts';
import { Place, PlaceView } from './places.ts';

const whole = wholeNumber(1, 'Please enter a whole number of 1 or more.');

/** One accepted thing a Trade requester offers, and optionally how much of it. */
export const ProposalOffer = z.strictObject({
  acceptId: z.uuid({ message: 'Please choose from the list.' }),
  amount: amount.nullish()
});

/**
 * The details a requester can set. `null` clears a detail; a missing field leaves it as it is.
 * "When" is a local date (YYYY-MM-DD) and an optional local time (HH:MM) in the community's time zone.
 */
export const ProposalDetailsInput = z.strictObject({
  date: z.iso.date({ message: 'Please choose a date.' }).nullish(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Please enter a time like 10:00.')
    .nullish(),
  handover: Handover.nullish(),
  place: Place.nullish(),
  loanLength: whole.nullish(),
  loanLengthUnit: LoanLengthUnit.nullish(),
  amount: amount.nullish(),
  offers: z.array(ProposalOffer).max(10).nullish(),
  ownOffer: z
    .string()
    .trim()
    .max(300, 'Please keep this to 300 characters or fewer.')
    .transform((value) => (value === '' ? null : value))
    .nullish(),
  ownOfferAmount: amount.nullish(),
  ownOfferUnit: Unit.nullish(),
  sessionLength: whole.nullish(),
  sessionLengthUnit: SessionLengthUnit.nullish(),
  sessions: whole.nullish()
});
export type ProposalDetailsInput = z.infer<typeof ProposalDetailsInput>;

export const CreateProposal = ProposalDetailsInput.extend({
  message: z
    .string()
    .trim()
    .max(4000, 'Please keep your message to 4000 characters or fewer.')
    .transform((value) => (value === '' ? null : value))
    .nullish()
});
export type CreateProposal = z.infer<typeof CreateProposal>;

export const AcceptProposal = z.object({ version: z.number().int().min(1) });

export const ProposalDecision = z.object({
  note: z
    .string()
    .trim()
    .max(500, 'Please keep the note to 500 characters or fewer.')
    .transform((value) => (value === '' ? null : value))
    .nullish()
});

export const ProposalStatus = z.enum(['open', 'accepted', 'declined', 'withdrawn', 'closed']);
export type ProposalStatus = z.infer<typeof ProposalStatus>;
export const ProposalClosedReason = z.enum(['nothing_left', 'quiet', 'member_left']);

/** Something that stops the lister from accepting yet, in words for the member. */
export const ProposalIssue = z.object({ field: z.string(), message: z.string() });
export type ProposalIssue = z.infer<typeof ProposalIssue>;

export const ProposalDetails = z.object({
  /** ISO time; a date without a time is midnight in the community's time zone. */
  startsAt: z.string().nullable(),
  hasTime: z.boolean(),
  /** The same "when" as local date and time, for forms. */
  date: z.string().nullable(),
  time: z.string().nullable(),
  handover: Handover.nullable(),
  /** For `at_lister`, the listing's area (only its display until accepted); null for online. */
  place: PlaceView.nullable(),
  loanLength: z.number().nullable(),
  loanLengthUnit: LoanLengthUnit.nullable(),
  amount: z.string().nullable(),
  offers: z.array(z.object({ acceptId: z.string(), description: z.string(), amount: z.string().nullable(), unit: Unit.nullable() })),
  ownOffer: z.string().nullable(),
  ownOfferAmount: z.string().nullable(),
  ownOfferUnit: Unit.nullable(),
  sessionLength: z.number().nullable(),
  sessionLengthUnit: SessionLengthUnit.nullable(),
  sessions: z.number().nullable()
});
export type ProposalDetails = z.infer<typeof ProposalDetails>;

export const Proposal = z.object({
  id: z.string(),
  status: ProposalStatus,
  closedReason: ProposalClosedReason.nullable(),
  version: z.number(),
  listing: z.object({ id: z.string(), title: z.string(), type: ListingType, unit: Unit.nullable() }),
  requester: memberRef,
  lister: memberRef,
  details: ProposalDetails,
  issues: z.array(ProposalIssue),
  /** The place couldn't be checked against the listing's area (it was typed, not picked). */
  areaUnchecked: z.boolean(),
  canAccept: z.boolean(),
  canEdit: z.boolean(),
  myRole: z.enum(['requester', 'lister', 'mediator']),
  conversationId: z.string(),
  agreementId: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string(),
  lastActivityAt: z.string()
});
export type Proposal = z.infer<typeof Proposal>;

export const ProposalSummary = z.object({
  id: z.string(),
  status: ProposalStatus,
  closedReason: ProposalClosedReason.nullable(),
  listing: z.object({ id: z.string(), title: z.string(), type: ListingType }),
  otherMember: memberRef,
  myRole: z.enum(['requester', 'lister']),
  /** Details still missing or not fitting, in short words ("when", "where"). */
  issues: z.array(ProposalIssue),
  unread: z.boolean(),
  lastActivityAt: z.string(),
  lastMessagePreview: z.string().nullable()
});
export type ProposalSummary = z.infer<typeof ProposalSummary>;

export const ProposalsQuery = z.object({
  role: z.enum(['requester', 'lister']).optional(),
  status: z.enum(['open', 'ended']).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20)
});
