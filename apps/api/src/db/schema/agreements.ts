// Agreements: made when a lister accepts a proposal (002 FR-018), confirmed from the start. They
// keep a copy of the accepted details, so later edits to the offering never change what was agreed.
// Loans hold a period; PostgreSQL refuses two unreturned loans of one offering whose periods overlap
// (an exclusion constraint added by hand in drizzle/0000_initial.sql, as drizzle-kit can't write it).
import { sql } from 'drizzle-orm';
import { boolean, check, customType, index, integer, jsonb, numeric, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import type { AgreementOfferSnapshot, Place } from '@wunan/shared';
import { handover, offering, sessionLengthUnit } from './offerings.ts';
import { member } from './members.ts';
import { proposal } from './proposals.ts';

/** Follows the offering's type: lend → lent, gift → gifted, trade → traded, service → provided. */
export const agreementOutcome = pgEnum('agreement_outcome', ['lent', 'gifted', 'traded', 'provided']);

const tstzrange = customType<{ data: string }>({ dataType: () => 'tstzrange' });

export const agreement = pgTable(
  'agreement',
  {
    id: uuid().primaryKey().defaultRandom(),
    proposalId: uuid()
      .notNull()
      .unique()
      .references(() => proposal.id),
    offeringId: uuid()
      .notNull()
      .references(() => offering.id, { onDelete: 'restrict' }),
    ownerId: uuid()
      .notNull()
      .references(() => member.id),
    otherMemberId: uuid()
      .notNull()
      .references(() => member.id),
    outcome: agreementOutcome().notNull(),
    startsAt: timestamp({ withTimezone: true }),
    hasTime: boolean().notNull().default(false),
    handover: handover(),
    place: jsonb().$type<Place>(),
    amount: numeric({ precision: 12, scale: 3 }),
    sessions: integer(),
    sessionLength: integer(),
    sessionLengthUnit: sessionLengthUnit(),
    offer: jsonb().$type<AgreementOfferSnapshot>(),
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('agreement_not_with_self', sql`${t.ownerId} <> ${t.otherMemberId}`),
    check('agreement_amount_positive', sql`${t.amount} is null or ${t.amount} > 0`),
    check('agreement_sessions_positive', sql`${t.sessions} is null or ${t.sessions} >= 1`),
    check(
      'agreement_loan_has_period',
      sql`(${t.outcome} = 'lent') = (${t.loanStartsAt} is not null and ${t.loanEndsAt} is not null and ${t.loanStartsAt} < ${t.loanEndsAt})`
    ),
    index('agreement_owner_idx').on(t.ownerId),
    index('agreement_other_idx').on(t.otherMemberId),
    index('agreement_offering_idx').on(t.offeringId)
  ]
);
