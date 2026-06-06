// Proposals (002 FR-010 to FR-021): a member asks for something on someone else's listing. The
// details are what the requester has agreed to; the lister accepts once nothing blocks it, which
// creates the agreement. Which details a type uses is enforced by the checks below and by
// modules/proposals.ts; what still blocks acceptance is worked out there, never stored.
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { Place } from '@wunan/shared';
import { handover, listing, loanLengthUnit, sessionLengthUnit, tradeAccept, unit } from './listings.ts';
import { member } from './members.ts';

export const proposalStatus = pgEnum('proposal_status', ['open', 'accepted', 'declined', 'withdrawn', 'closed']);
/** Why a proposal closed by itself: nothing left on the listing, a quiet month, or a member left. */
export const proposalClosedReason = pgEnum('proposal_closed_reason', ['nothing_left', 'quiet', 'member_left']);

export const proposal = pgTable(
  'proposal',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listing.id, { onDelete: 'restrict' }),
    requesterId: uuid()
      .notNull()
      .references(() => member.id),
    status: proposalStatus().notNull().default('open'),
    closedReason: proposalClosedReason(),
    /** +1 on every detail change; accepting must name the version the lister saw. */
    version: integer().notNull().default(1),
    /** "When": a date without a time is midnight in the community's time zone. */
    startsAt: timestamp({ withTimezone: true }),
    hasTime: boolean().notNull().default(false),
    handover: handover(),
    /** Not stored for `at_lister` (the listing's area is used) or `online`. */
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
    decisionNote: text(),
    /** Every message and change moves this on; a quiet month closes the proposal (FR-020a). */
    lastActivityAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    acceptedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('proposal_closed_has_reason', sql`(${t.status} = 'closed') = (${t.closedReason} is not null)`),
    check('proposal_positive_numbers', sql`
      (${t.loanLength} is null or ${t.loanLength} > 0) and (${t.amount} is null or ${t.amount} > 0)
      and (${t.ownOfferAmount} is null or ${t.ownOfferAmount} > 0)
      and (${t.sessionLength} is null or ${t.sessionLength} > 0) and (${t.sessions} is null or ${t.sessions} >= 1)`),
    check('proposal_units_with_numbers', sql`
      (${t.loanLength} is null) = (${t.loanLengthUnit} is null)
      and (${t.sessionLength} is null) = (${t.sessionLengthUnit} is null)
      and (${t.ownOfferAmount} is null) = (${t.ownOfferUnit} is null)`),
    check('proposal_text_lengths', sql`
      (${t.ownOffer} is null or char_length(${t.ownOffer}) <= 300)
      and (${t.decisionNote} is null or char_length(${t.decisionNote}) <= 500)`),
    // One open proposal per member per listing: they change it instead of starting another.
    uniqueIndex('proposal_one_open_per_requester').on(t.listingId, t.requesterId).where(sql`${t.status} = 'open'`),
    index('proposal_requester_status_idx').on(t.requesterId, t.status),
    index('proposal_listing_status_idx').on(t.listingId, t.status),
    index('proposal_quiet_idx').on(t.status, t.lastActivityAt)
  ]
);

/** The accepted things a Trade requester chose to offer (FR-013). */
export const proposalOffer = pgTable(
  'proposal_offer',
  {
    id: uuid().primaryKey().defaultRandom(),
    proposalId: uuid()
      .notNull()
      .references(() => proposal.id, { onDelete: 'cascade' }),
    tradeAcceptId: uuid()
      .notNull()
      .references(() => tradeAccept.id, { onDelete: 'cascade' }),
    amount: numeric({ precision: 12, scale: 3 }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('proposal_offer_amount', sql`${t.amount} is null or ${t.amount} > 0`),
    uniqueIndex('proposal_offer_once').on(t.proposalId, t.tradeAcceptId)
  ]
);
