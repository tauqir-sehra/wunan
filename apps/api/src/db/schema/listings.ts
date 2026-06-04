// Listings: things members offer (Lend, Gift, Trade, Service), their photos, and flags from other
// members (FR-007 to FR-014, FR-013a). Fields that don't apply to a listing's type must be null;
// the check constraints below enforce that, alongside the shared Zod schema.
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import { member } from './members.ts';

export const listingTypes = ['lend', 'gift', 'trade', 'service'] as const;
export const units = ['item', 'kg', 'g', 'litre', 'hour', 'portion', 'bag', 'box', 'other'] as const;

export const listingType = pgEnum('listing_type', listingTypes);
export const unit = pgEnum('unit', units);
export const loanLengthUnit = pgEnum('loan_length_unit', ['hours', 'days', 'weeks']);
export const sessionLengthUnit = pgEnum('session_length_unit', ['minutes', 'hours']);
export const listingStatus = pgEnum('listing_status', ['available', 'lent_out', 'paused', 'closed']);
/** Why a listing is closed: the owner removed it (can reopen), or nothing remains (can't). */
export const closedReason = pgEnum('closed_reason', ['removed', 'used_up']);

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const listing = pgTable(
  'listing',
  {
    id: uuid().primaryKey().defaultRandom(),
    ownerId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    type: listingType().notNull(),
    title: text().notNull(),
    description: text(),
    amount: numeric({ precision: 12, scale: 3 }),
    unit: unit(),
    remaining: numeric({ precision: 12, scale: 3 }),
    loanLength: integer(),
    loanLengthUnit: loanLengthUnit(),
    wanted: text(),
    wantedAmount: numeric({ precision: 12, scale: 3 }),
    wantedUnit: unit(),
    openToOffers: boolean().notNull().default(false),
    sessionLength: integer(),
    sessionLengthUnit: sessionLengthUnit(),
    sessionsAvailable: integer(),
    sessionsRemaining: integer(),
    area: text(),
    status: listingStatus().notNull().default('available'),
    closedReason: closedReason(),
    // Kept up to date by PostgreSQL itself; used by search (research §5).
    searchVector: tsvector().generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '') || ' ' || coalesce("wanted", '')), 'B')`
    ),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('listing_title_length', sql`char_length(${t.title}) between 1 and 100`),
    check('listing_description_length', sql`${t.description} is null or char_length(${t.description}) <= 2000`),
    check('listing_wanted_length', sql`${t.wanted} is null or char_length(${t.wanted}) <= 300`),
    check('listing_area_length', sql`${t.area} is null or char_length(${t.area}) <= 60`),
    check('listing_positive_numbers', sql`
      (${t.amount} is null or ${t.amount} > 0) and (${t.remaining} is null or ${t.remaining} >= 0)
      and (${t.wantedAmount} is null or ${t.wantedAmount} > 0) and (${t.loanLength} is null or ${t.loanLength} > 0)
      and (${t.sessionLength} is null or ${t.sessionLength} > 0)
      and (${t.sessionsAvailable} is null or ${t.sessionsAvailable} >= 1)
      and (${t.sessionsRemaining} is null or ${t.sessionsRemaining} >= 0)`),
    check('listing_units_with_numbers', sql`
      (${t.amount} is null) = (${t.unit} is null)
      and (${t.loanLength} is null) = (${t.loanLengthUnit} is null)
      and (${t.wantedAmount} is null) = (${t.wantedUnit} is null)
      and (${t.sessionLength} is null) = (${t.sessionLengthUnit} is null)`),
    check('listing_fields_match_type', sql`
      (${t.type} = 'lend' or (${t.loanLength} is null))
      and (${t.type} = 'trade' or (${t.wanted} is null and ${t.wantedAmount} is null and not ${t.openToOffers}))
      and (${t.type} = 'service' or (${t.sessionLength} is null and ${t.sessionsAvailable} is null and ${t.sessionsRemaining} is null))
      and (${t.type} <> 'service' or (${t.amount} is null))
      and (${t.type} in ('gift', 'trade') or ${t.remaining} is null)`),
    check('listing_trade_wants_something', sql`${t.type} <> 'trade' or ${t.wanted} is not null or ${t.openToOffers}`),
    check('listing_closed_has_reason', sql`(${t.status} = 'closed') = (${t.closedReason} is not null)`),
    index('listing_search_idx').using('gin', t.searchVector),
    index('listing_status_created_idx').on(t.status, t.createdAt),
    index('listing_type_idx').on(t.type),
    index('listing_owner_idx').on(t.ownerId)
  ]
);

export const listingPhoto = pgTable(
  'listing_photo',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listing.id, { onDelete: 'cascade' }),
    /** Random file name on the photos volume (never derived from the upload). */
    fileKey: text().notNull().unique(),
    altText: text(),
    position: smallint().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('listing_photo_alt_length', sql`${t.altText} is null or char_length(${t.altText}) <= 200`),
    index('listing_photo_listing_idx').on(t.listingId)
  ]
);

/** A member's written request to a listing's owner. Never hides or changes the listing. */
export const listingFlag = pgTable(
  'listing_flag',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listing.id, { onDelete: 'cascade' }),
    flaggedById: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    request: text().notNull(),
    seenByOwnerAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('listing_flag_request_length', sql`char_length(${t.request}) between 1 and 500`),
    index('listing_flag_listing_idx').on(t.listingId)
  ]
);
