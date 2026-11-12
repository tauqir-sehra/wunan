// Arrangements (004): one exchange between a requester and an offering's owner, from the first ask
// to its end. While `status` is `open` the detail columns are what the requester is asking for;
// from `agreed` on they are the fixed record of what was agreed (the service layer only changes
// details while open). The few things that could change afterwards are copied on accepting:
// the place as resolved, what is given in return, and the loan's period.
// Which details a type uses is enforced by the checks below and by modules/arrangements.ts; what
// still blocks accepting, the stage, and the timeline are worked out there, never stored.
// Loans hold a period; PostgreSQL refuses two unreturned loans of one offering whose periods overlap
// (an exclusion constraint added by hand in drizzle/0000_initial.sql, as drizzle-kit can't write it).
import { sql } from 'drizzle-orm';
import { type AnyPgColumn, boolean, check, customType, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { AgreedOffer, Place } from '@wunan/shared';
import { handover, offering, loanLengthUnit, sessionLengthUnit, tradeAccept, unit } from './offerings.ts';
import { member } from './members.ts';
import { request } from './requests.ts';

export const arrangementStatus = pgEnum('arrangement_status', ['open', 'agreed', 'declined', 'withdrawn', 'closed']);
/** Why an arrangement closed by itself: nothing left on the offering, a quiet month, or a member left. */
export const arrangementClosedReason = pgEnum('arrangement_closed_reason', ['nothing_left', 'quiet', 'member_left']);

const tstzrange = customType<{ data: string }>({ dataType: () => 'tstzrange' });

export const arrangement = pgTable(
  'arrangement',
  {
    id: uuid().primaryKey().defaultRandom(),
    offeringId: uuid()
      .notNull()
      .references(() => offering.id, { onDelete: 'restrict' }),
    requesterId: uuid()
      .notNull()
      .references(() => member.id),
    /** The asker's request this answers, set only on an offering linked to it (003 research §3). */
    requestId: uuid().references((): AnyPgColumn => request.id, { onDelete: 'set null' }),
    status: arrangementStatus().notNull().default('open'),
    closedReason: arrangementClosedReason(),
    /** +1 on every detail change and on asking again; accepting must name the version the lister saw. */
    version: integer().notNull().default(1),
    /** "When": a date without a time is midnight in the community's time zone. */
    startsAt: timestamp({ withTimezone: true }),
    hasTime: boolean().notNull().default(false),
    handover: handover(),
    /** As asked. Not stored for `at_lister` (the offering's area is used) or `online`. */
    place: jsonb().$type<Place>(),
    loanLength: integer(),
    loanLengthUnit: loanLengthUnit(),
    amount: numeric({ precision: 12, scale: 3 }),
    /** Trade open to offers: what the requester offers in their own words. */
    ownOffer: text(),
    ownOfferAmount: numeric({ precision: 12, scale: 3 }),
    ownOfferUnit: unit(),
    sessionLength: integer(),
    sessionLengthUnit: sessionLengthUnit(),
    sessions: integer(),
    /** The note that came with a decline or withdrawal; cleared on asking again. */
    decisionNote: text(),
    /** Every message and change moves this on; orders the list; a quiet month closes an open one (002 FR-020a). */
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),

    // ── The agreed record: set on accepting, null otherwise ──
    agreedAt: timestamp({ withTimezone: true }),
    /** The place as resolved on accepting (the offering's area for `at_lister`). */
    agreedPlace: jsonb().$type<Place>(),
    /** Trade: what is given in return, copied so later edits to the offering can't change it. */
    agreedOffer: jsonb().$type<AgreedOffer>(),
    /** Lend only: from the pickup time to the pickup time plus the loan length. */
    loanStartsAt: timestamp({ withTimezone: true }),
    loanEndsAt: timestamp({ withTimezone: true }),
    // Null for anything but a loan: tstzrange(null, null) would mean "for ever" and clash with every loan.
    loanPeriod: tstzrange().generatedAlwaysAs(
      sql`case when "loan_starts_at" is null then null else tstzrange("loan_starts_at", "loan_ends_at") end`
    ),
    returnedAt: timestamp({ withTimezone: true }),
    /** Set when the one return reminder was sent, so it is never sent twice. */
    reminderSentAt: timestamp({ withTimezone: true }),
    /** Gift, trade, service: a member marked it as done (004 FR-009a). Can be taken back. */
    doneAt: timestamp({ withTimezone: true }),
    doneById: uuid().references(() => member.id),

    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('arrangement_closed_has_reason', sql`(${t.status} = 'closed') = (${t.closedReason} is not null)`),
    check('arrangement_positive_numbers', sql`
      (${t.loanLength} is null or ${t.loanLength} > 0) and (${t.amount} is null or ${t.amount} > 0)
      and (${t.ownOfferAmount} is null or ${t.ownOfferAmount} > 0)
      and (${t.sessionLength} is null or ${t.sessionLength} > 0) and (${t.sessions} is null or ${t.sessions} >= 1)`),
    check('arrangement_units_with_numbers', sql`
      (${t.loanLength} is null) = (${t.loanLengthUnit} is null)
      and (${t.sessionLength} is null) = (${t.sessionLengthUnit} is null)
      and (${t.ownOfferAmount} is null) = (${t.ownOfferUnit} is null)`),
    check('arrangement_text_lengths', sql`
      (${t.ownOffer} is null or char_length(${t.ownOffer}) <= 300)
      and (${t.decisionNote} is null or char_length(${t.decisionNote}) <= 500)`),
    check('arrangement_agreed_has_time', sql`(${t.status} = 'agreed') = (${t.agreedAt} is not null)`),
    check('arrangement_record_only_when_agreed', sql`
      ${t.status} = 'agreed' or (${t.agreedPlace} is null and ${t.agreedOffer} is null and ${t.loanStartsAt} is null
      and ${t.loanEndsAt} is null and ${t.returnedAt} is null and ${t.reminderSentAt} is null and ${t.doneAt} is null)`),
    check('arrangement_loan_period', sql`
      (${t.loanStartsAt} is null) = (${t.loanEndsAt} is null) and (${t.loanStartsAt} is null or ${t.loanStartsAt} < ${t.loanEndsAt})`),
    check('arrangement_returned_is_a_loan', sql`${t.returnedAt} is null or ${t.loanStartsAt} is not null`),
    check('arrangement_done_is_not_a_loan', sql`${t.doneAt} is null or ${t.loanStartsAt} is null`),
    check('arrangement_done_has_who', sql`(${t.doneAt} is null) = (${t.doneById} is null)`),
    // At most one arrangement per requester and offering that isn't agreed: asking again reopens it (004 FR-010a).
    uniqueIndex('arrangement_one_not_agreed_per_requester').on(t.offeringId, t.requesterId).where(sql`${t.status} <> 'agreed'`),
    index('arrangement_requester_status_idx').on(t.requesterId, t.status),
    index('arrangement_offering_status_idx').on(t.offeringId, t.status),
    index('arrangement_quiet_idx').on(t.status, t.lastActivityAt)
  ]
);

/** The listed things a Trade requester chose to offer (002 FR-013). */
export const arrangementOffer = pgTable(
  'arrangement_offer',
  {
    id: uuid().primaryKey().defaultRandom(),
    arrangementId: uuid()
      .notNull()
      .references(() => arrangement.id, { onDelete: 'cascade' }),
    tradeAcceptId: uuid()
      .notNull()
      .references(() => tradeAccept.id, { onDelete: 'cascade' }),
    amount: numeric({ precision: 12, scale: 3 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('arrangement_offer_amount', sql`${t.amount} is null or ${t.amount} > 0`),
    uniqueIndex('arrangement_offer_once').on(t.arrangementId, t.tradeAcceptId)
  ]
);
