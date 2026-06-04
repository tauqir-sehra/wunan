// Agreements: what the owner of a listing recorded with another member (FR-022 to FR-026).
// Recording one updates the listing (remaining amount, sessions, lent out); see modules/agreements.ts.
import { sql } from 'drizzle-orm';
import { check, date, index, integer, numeric, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { listing } from './listings.ts';
import { member } from './members.ts';

/** Follows the listing's type: lend → lent, gift → gifted, trade → traded, service → provided. */
export const agreementOutcome = pgEnum('agreement_outcome', ['lent', 'gifted', 'traded', 'provided']);
/** pending → confirmed / disputed by the other member, or cancelled by the owner while pending. */
export const agreementConfirmation = pgEnum('agreement_confirmation', ['pending', 'confirmed', 'disputed', 'cancelled']);

export const agreement = pgTable(
  'agreement',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listing.id, { onDelete: 'restrict' }),
    ownerId: uuid()
      .notNull()
      .references(() => member.id),
    otherMemberId: uuid()
      .notNull()
      .references(() => member.id),
    outcome: agreementOutcome().notNull(),
    amount: numeric({ precision: 12, scale: 3 }),
    sessions: integer(),
    returnDue: date({ mode: 'string' }),
    returnedAt: timestamp({ withTimezone: true }),
    /** Set when the one return reminder was sent, so it is never sent twice. */
    reminderSentAt: timestamp({ withTimezone: true }),
    confirmation: agreementConfirmation().notNull().default('pending'),
    note: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('agreement_not_with_self', sql`${t.ownerId} <> ${t.otherMemberId}`),
    check('agreement_amount_positive', sql`${t.amount} is null or ${t.amount} > 0`),
    check('agreement_sessions_positive', sql`${t.sessions} is null or ${t.sessions} >= 1`),
    check('agreement_loan_has_return_date', sql`${t.outcome} <> 'lent' or ${t.returnDue} is not null`),
    check('agreement_note_length', sql`${t.note} is null or char_length(${t.note}) <= 500`),
    index('agreement_owner_idx').on(t.ownerId),
    index('agreement_other_idx').on(t.otherMemberId),
    index('agreement_listing_idx').on(t.listingId)
  ]
);
