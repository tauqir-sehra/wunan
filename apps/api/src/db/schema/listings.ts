// Listings: things members offer (Lend, Gift, Trade, Service), what a trade accepts, when a service
// is offered, their photos, and flags from other members (001 FR-007 to FR-014; 002 FR-001 to
// FR-009). Fields that don't apply to a listing's type must be null; the check constraints below
// enforce that, alongside the shared Zod schema.
import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  smallint,
  text,
  time,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';
import type { Place } from '@wunan/shared';
import { member } from './members.ts';

export const listingTypes = ['lend', 'gift', 'trade', 'service'] as const;
export const units = ['item', 'kg', 'g', 'lb', 'oz', 'litre', 'hour', 'portion', 'bag', 'box', 'other'] as const;

export const listingType = pgEnum('listing_type', listingTypes);
export const unit = pgEnum('unit', units);
export const loanLengthUnit = pgEnum('loan_length_unit', ['hours', 'days', 'weeks']);
export const sessionLengthUnit = pgEnum('session_length_unit', ['minutes', 'hours', 'days', 'weeks']);
/** "Lent out" is not a status: it is worked out from loans in progress (002 research §4). */
export const listingStatus = pgEnum('listing_status', ['available', 'paused', 'closed']);
/** How the handover happens; the words shown depend on the listing's type (002 research §6). */
export const handover = pgEnum('handover', ['to_requester', 'at_lister', 'elsewhere', 'online']);
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
    sessionLength: integer(),
    sessionLengthUnit: sessionLengthUnit(),
    sessionsAvailable: integer(),
    sessionsRemaining: integer(),
    handovers: handover().array().notNull().default(sql`'{}'`),
    /** The full place; others see only its neighbourhood and city (002 FR-029). */
    area: jsonb().$type<Place>(),
    // Lower-cased parts of the area, for the search filter and the service area check.
    areaNeighbourhood: text().generatedAlwaysAs(sql`lower("area"->>'neighbourhood')`),
    areaCity: text().generatedAlwaysAs(sql`lower("area"->>'city')`),
    /** Needed when "meet somewhere else" is offered (002 FR-004). */
    meetingPlace: jsonb().$type<Place>(),
    status: listingStatus().notNull().default('available'),
    closedReason: closedReason(),
    /**
     * Title (weight A), description and accepted things (weight B). Set by modules/listings.ts on
     * every save, because accepted things live in another table (001 research §13).
     */
    searchVector: tsvector(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('listing_title_length', sql`char_length(${t.title}) between 1 and 100`),
    check('listing_description_length', sql`${t.description} is null or char_length(${t.description}) <= 2000`),
    check('listing_at_lister_has_area', sql`not ('at_lister' = any(${t.handovers})) or ${t.area} is not null`),
    check('listing_elsewhere_has_place', sql`not ('elsewhere' = any(${t.handovers})) or ${t.meetingPlace} is not null`),
    check('listing_positive_numbers', sql`
      (${t.amount} is null or ${t.amount} > 0) and (${t.remaining} is null or ${t.remaining} >= 0)
      and (${t.loanLength} is null or ${t.loanLength} > 0)
      and (${t.sessionLength} is null or ${t.sessionLength} > 0)
      and (${t.sessionsAvailable} is null or ${t.sessionsAvailable} >= 1)
      and (${t.sessionsRemaining} is null or ${t.sessionsRemaining} >= 0)`),
    check('listing_units_with_numbers', sql`
      (${t.amount} is null) = (${t.unit} is null)
      and (${t.loanLength} is null) = (${t.loanLengthUnit} is null)
      and (${t.sessionLength} is null) = (${t.sessionLengthUnit} is null)`),
    check('listing_fields_match_type', sql`
      (${t.type} = 'lend' or (${t.loanLength} is null))
      and (${t.type} = 'service' or (${t.sessionLength} is null and ${t.sessionsAvailable} is null and ${t.sessionsRemaining} is null))
      and (${t.type} <> 'service' or (${t.amount} is null))
      and (${t.type} in ('gift', 'trade') or ${t.remaining} is null)`),
    check('listing_closed_has_reason', sql`(${t.status} = 'closed') = (${t.closedReason} is not null)`),
    index('listing_search_idx').using('gin', t.searchVector),
    index('listing_status_created_idx').on(t.status, t.createdAt),
    index('listing_type_idx').on(t.type),
    index('listing_owner_idx').on(t.ownerId),
    index('listing_area_neighbourhood_idx').on(t.areaNeighbourhood),
    index('listing_area_city_idx').on(t.areaCity)
  ]
);

/** One thing a Trade listing accepts in return (002 FR-005). None means open to offers. */
export const tradeAccept = pgTable(
  'trade_accept',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listing.id, { onDelete: 'cascade' }),
    position: smallint().notNull().default(0),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 3 }),
    unit: unit(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('trade_accept_position', sql`${t.position} between 0 and 9`),
    check('trade_accept_description_length', sql`char_length(${t.description}) between 1 and 100`),
    check('trade_accept_amount', sql`(${t.amount} is null or ${t.amount} > 0) and (${t.amount} is null) = (${t.unit} is null)`),
    index('trade_accept_listing_idx').on(t.listingId)
  ]
);

/** A weekly time a Service is offered, in the community's time zone (002 FR-009). */
export const serviceAvailability = pgTable(
  'service_availability',
  {
    id: uuid().primaryKey().defaultRandom(),
    listingId: uuid()
      .notNull()
      .references(() => listing.id, { onDelete: 'cascade' }),
    /** 1 = Monday … 7 = Sunday (ISO). */
    weekday: smallint().notNull(),
    startTime: time().notNull(),
    endTime: time().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('service_availability_weekday', sql`${t.weekday} between 1 and 7`),
    check('service_availability_times', sql`${t.startTime} < ${t.endTime}`),
    index('service_availability_listing_idx').on(t.listingId)
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
