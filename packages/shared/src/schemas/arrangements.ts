// Arrangements (004): one exchange between a requester and an offering's owner, from the first ask
// to its end. While it is open, every detail is optional and only the requester changes them; what
// it says is what the requester has agreed to. Once the lister accepts it is agreed and its details
// are fixed. Which details apply depends on the offering's type; the API refuses details that don't
// apply, and lists what still blocks accepting as issues. Stage, "needs me" and the timeline are
// worked out by the API on every read, never stored.
import { z } from 'zod';
import { memberRef } from './common.ts';
import { amount, Handover, OfferingType, LoanLengthUnit, SessionLengthUnit, Unit, wholeNumber } from './offerings.ts';
import { Place, PlaceView } from './places.ts';

const whole = wholeNumber(1, 'Please enter a whole number of 1 or more.');

/** One accepted thing a Trade requester offers, and optionally how much of it. */
export const ArrangementOffer = z.strictObject({
  acceptId: z.uuid({ message: 'Please choose from the list.' }),
  amount: amount.nullish()
});

/**
 * The details a requester can set. `null` clears a detail; a missing field leaves it as it is.
 * "When" is a local date (YYYY-MM-DD) and an optional local time (HH:MM) in the community's time zone.
 */
export const ArrangementDetailsInput = z.strictObject({
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
  offers: z.array(ArrangementOffer).max(10).nullish(),
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
export type ArrangementDetailsInput = z.infer<typeof ArrangementDetailsInput>;

export const CreateArrangement = ArrangementDetailsInput.extend({
  /** The asker's request this answers, when the offering is linked to several of their requests (003 FR-017). */
  requestId: z.uuid({ message: 'Please choose which request this is for.' }).optional(),
  message: z
    .string()
    .trim()
    .max(4000, 'Please keep your message to 4000 characters or fewer.')
    .transform((value) => (value === '' ? null : value))
    .nullish()
});
export type CreateArrangement = z.infer<typeof CreateArrangement>;

export const AcceptArrangement = z.object({ version: z.number().int().min(1) });

export const ArrangementDecision = z.object({
  note: z
    .string()
    .trim()
    .max(500, 'Please keep the note to 500 characters or fewer.')
    .transform((value) => (value === '' ? null : value))
    .nullish()
});

export const ArrangementStatus = z.enum(['open', 'agreed', 'declined', 'withdrawn', 'closed']);
export type ArrangementStatus = z.infer<typeof ArrangementStatus>;
export const ArrangementClosedReason = z.enum(['nothing_left', 'quiet', 'member_left']);

/** Where an arrangement stands, in one word; pages turn it into plain words. */
export const ArrangementStage = z.enum(['arranging', 'agreed', 'on_loan', 'returned', 'done', 'ended']);
export type ArrangementStage = z.infer<typeof ArrangementStage>;

/** Something that stops the lister from accepting yet, in words for the member. */
export const ArrangementIssue = z.object({ field: z.string(), message: z.string() });
export type ArrangementIssue = z.infer<typeof ArrangementIssue>;

/** What is given in return in a Trade, copied when it is agreed so later edits can't change it. */
export const AgreedOffer = z.object({
  items: z.array(z.object({ description: z.string(), amount: z.string().nullable(), unit: Unit.nullable() })),
  own: z.object({ description: z.string(), amount: z.string().nullable(), unit: Unit.nullable() }).nullable()
});
export type AgreedOffer = z.infer<typeof AgreedOffer>;

export const ArrangementDetails = z.object({
  /** ISO time; a date without a time is midnight in the community's time zone. */
  startsAt: z.string().nullable(),
  hasTime: z.boolean(),
  /** The same "when" as local date and time, for forms. */
  date: z.string().nullable(),
  time: z.string().nullable(),
  handover: Handover.nullable(),
  /** For `at_lister`, the offering's area (only its display until agreed); null for online. */
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
export type ArrangementDetails = z.infer<typeof ArrangementDetails>;

/** The fixed record, present once the arrangement is agreed. */
export const Agreed = z.object({
  at: z.string(),
  /** The place as it was when agreed, in full for the two members and helpers. */
  place: PlaceView.nullable(),
  offer: AgreedOffer.nullable(),
  loanStartsAt: z.string().nullable(),
  loanEndsAt: z.string().nullable(),
  /** A loan past its end and not marked returned. */
  overdue: z.boolean(),
  returnedAt: z.string().nullable(),
  doneAt: z.string().nullable(),
  doneBy: memberRef.nullable()
});
export type Agreed = z.infer<typeof Agreed>;

/** One line of the timeline: what happened and when, or (with `at` null) what is still expected. */
export const TimelineStep = z.object({
  step: z.enum(['asked', 'details_changed', 'agreed', 'declined', 'withdrawn', 'closed', 'lent', 'due_back', 'returned', 'done', 'help_asked', 'help_outcome']),
  at: z.string().nullable(),
  /** Who did it; null for wunan, and for steps still expected. */
  by: memberRef.nullable()
});
export type TimelineStep = z.infer<typeof TimelineStep>;

export const Arrangement = z.object({
  id: z.string(),
  status: ArrangementStatus,
  closedReason: ArrangementClosedReason.nullable(),
  stage: ArrangementStage,
  version: z.number(),
  offering: z.object({ id: z.string(), title: z.string(), type: OfferingType, unit: Unit.nullable() }),
  requester: memberRef,
  lister: memberRef,
  details: ArrangementDetails,
  issues: z.array(ArrangementIssue),
  /** The place couldn't be checked against the offering's area (it was typed, not picked). */
  areaUnchecked: z.boolean(),
  /** The asker's request this answers; accepting closes the request (003 FR-016). */
  request: z.object({ id: z.string(), title: z.string(), status: z.enum(['open', 'closed']) }).nullable(),
  agreed: Agreed.nullable(),
  /** For a loan: an earlier loan of the same item is past its end and not marked returned. */
  earlierLoanNotBack: z.object({ endsAt: z.string() }).nullable(),
  timeline: z.array(TimelineStep),
  /** Requests for help about this arrangement. */
  reports: z.array(z.object({ id: z.string(), status: z.enum(['open', 'resolved']), outcomeNote: z.string().nullable() })),
  canAccept: z.boolean(),
  canEdit: z.boolean(),
  /** The requester may ask again: it ended without agreement and the offering is available. */
  canAskAgain: z.boolean(),
  myRole: z.enum(['requester', 'lister', 'helper']),
  /** Null for a helper the messages weren't shared with. */
  conversationId: z.string().nullable(),
  decisionNote: z.string().nullable(),
  createdAt: z.string(),
  lastActivityAt: z.string()
});
export type Arrangement = z.infer<typeof Arrangement>;

export const ArrangementSummary = z.object({
  id: z.string(),
  status: ArrangementStatus,
  closedReason: ArrangementClosedReason.nullable(),
  stage: ArrangementStage,
  /** This member can or must do something, or has an unread message from the other member. */
  needsMe: z.boolean(),
  offering: z.object({ id: z.string(), title: z.string(), type: OfferingType }),
  otherMember: memberRef,
  myRole: z.enum(['requester', 'lister']),
  /** Details still missing or not fitting, in short words ("when", "where"); empty unless open. */
  issues: z.array(ArrangementIssue),
  /** The asked or agreed day, when there is one. */
  startsAt: z.string().nullable(),
  hasTime: z.boolean(),
  loanEndsAt: z.string().nullable(),
  overdue: z.boolean(),
  returnedAt: z.string().nullable(),
  doneAt: z.string().nullable(),
  /** An unread message from the other member. */
  unread: z.boolean(),
  lastActivityAt: z.string(),
  lastMessagePreview: z.string().nullable()
});
export type ArrangementSummary = z.infer<typeof ArrangementSummary>;

/** My arrangements in three groups; only "finished" is paged (20 at a time). */
export const ArrangementList = z.object({
  needsYou: z.array(ArrangementSummary),
  inProgress: z.array(ArrangementSummary),
  finished: z.array(ArrangementSummary),
  finishedNext: z.string().nullable()
});
export type ArrangementList = z.infer<typeof ArrangementList>;

export const ArrangementsQuery = z.object({
  side: z.enum(['asked', 'offered']).optional(),
  group: z.enum(['finished']).optional(),
  cursor: z.string().max(200).optional()
});
