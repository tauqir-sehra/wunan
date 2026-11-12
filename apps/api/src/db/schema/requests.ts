// Requests (003): what a member asks for (Borrow, Receive, Trade, Service), what a Trade asker
// could give back, the weekly times that suit a Service asker, and the offerings linked to a
// request as possibly answering it. Fields that don't apply to a request's kind must be null; the
// check constraints below enforce that, alongside the shared Zod schema.
import { sql } from 'drizzle-orm';
import { type AnyPgColumn, check, customType, date, index, integer, jsonb, numeric, pgEnum, pgTable, smallint, text, time, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import type { Place } from '@wunan/shared';
import { arrangement } from './arrangements.ts';
import { handover, offering, loanLengthUnit, sessionLengthUnit, unit } from './offerings.ts';
import { member } from './members.ts';

export const requestKind = pgEnum('request_kind', ['borrow', 'receive', 'trade', 'service']);
export const requestStatus = pgEnum('request_status', ['open', 'closed']);
/** Closed by the asker (can reopen), by an agreed arrangement (can reopen), or because they left. */
export const requestClosedReason = pgEnum('request_closed_reason', ['by_asker', 'agreed', 'account_deleted']);

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

export const request = pgTable(
  'request',
  {
    id: uuid().primaryKey().defaultRandom(),
    askerId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    kind: requestKind().notNull(),
    title: text().notNull(),
    description: text(),
    /** When it's needed (FR-002a): both empty means no fixed date. Dates only, no times. */
    neededAfter: date({ mode: 'string' }),
    neededBy: date({ mode: 'string' }),
    /** The full place; others see only its neighbourhood and city (FR-028). */
    area: jsonb().$type<Place>(),
    areaNeighbourhood: text().generatedAlwaysAs(sql`lower("area"->>'neighbourhood')`),
    areaCity: text().generatedAlwaysAs(sql`lower("area"->>'city')`),
    handovers: handover().array().notNull().default(sql`'{}'`),
    loanLength: integer(),
    loanLengthUnit: loanLengthUnit(),
    amount: numeric({ precision: 12, scale: 3 }),
    unit: unit(),
    sessionLength: integer(),
    sessionLengthUnit: sessionLengthUnit(),
    sessions: integer(),
    status: requestStatus().notNull().default('open'),
    closedReason: requestClosedReason(),
    closedByArrangementId: uuid().references((): AnyPgColumn => arrangement.id, { onDelete: 'set null' }),
    /** Title (weight A), description and give-back items (weight B); set by modules/requests.ts on every save. */
    searchVector: tsvector(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('request_title_length', sql`char_length(${t.title}) between 1 and 100`),
    check('request_description_length', sql`${t.description} is null or char_length(${t.description}) <= 2000`),
    check('request_dates_in_order', sql`${t.neededAfter} is null or ${t.neededBy} is null or ${t.neededBy} >= ${t.neededAfter}`),
    check('request_positive_numbers', sql`
      (${t.amount} is null or ${t.amount} > 0) and (${t.loanLength} is null or ${t.loanLength} > 0)
      and (${t.sessionLength} is null or ${t.sessionLength} > 0) and (${t.sessions} is null or ${t.sessions} >= 1)`),
    check('request_units_with_numbers', sql`
      (${t.amount} is null) = (${t.unit} is null)
      and (${t.loanLength} is null) = (${t.loanLengthUnit} is null)
      and (${t.sessionLength} is null) = (${t.sessionLengthUnit} is null)`),
    check('request_fields_match_kind', sql`
      (${t.kind} = 'borrow' or ${t.loanLength} is null)
      and (${t.kind} in ('receive', 'trade') or ${t.amount} is null)
      and (${t.kind} = 'service' or (${t.sessionLength} is null and ${t.sessions} is null))`),
    check('request_closed_has_reason', sql`(${t.status} = 'closed') = (${t.closedReason} is not null)`),
    check('request_arrangement_only_when_agreed', sql`${t.closedByArrangementId} is null or ${t.closedReason} = 'agreed'`),
    index('request_search_idx').using('gin', t.searchVector),
    index('request_status_created_idx').on(t.status, t.createdAt),
    index('request_kind_idx').on(t.kind),
    index('request_asker_idx').on(t.askerId),
    index('request_area_neighbourhood_idx').on(t.areaNeighbourhood),
    index('request_area_city_idx').on(t.areaCity)
  ]
);

/** One thing a Trade asker could give back (FR-005). None means open to talking about it. */
export const requestGiveBack = pgTable(
  'request_give_back',
  {
    id: uuid().primaryKey().defaultRandom(),
    requestId: uuid()
      .notNull()
      .references(() => request.id, { onDelete: 'cascade' }),
    position: smallint().notNull().default(0),
    description: text().notNull(),
    amount: numeric({ precision: 12, scale: 3 }),
    unit: unit()
  },
  (t) => [
    check('request_give_back_position', sql`${t.position} between 0 and 9`),
    check('request_give_back_description_length', sql`char_length(${t.description}) between 1 and 100`),
    check('request_give_back_amount', sql`(${t.amount} is null or ${t.amount} > 0) and (${t.amount} is null) = (${t.unit} is null)`),
    index('request_give_back_request_idx').on(t.requestId)
  ]
);

/** A weekly time that suits a Service asker, in the community's time zone (FR-006). */
export const requestAvailability = pgTable(
  'request_availability',
  {
    id: uuid().primaryKey().defaultRandom(),
    requestId: uuid()
      .notNull()
      .references(() => request.id, { onDelete: 'cascade' }),
    /** 1 = Monday … 7 = Sunday (ISO), as for service offerings. */
    weekday: smallint().notNull(),
    startTime: time().notNull(),
    endTime: time().notNull()
  },
  (t) => [
    check('request_availability_weekday', sql`${t.weekday} between 1 and 7`),
    check('request_availability_times', sql`${t.startTime} < ${t.endTime}`),
    index('request_availability_request_idx').on(t.requestId)
  ]
);

/** An offering linked to a request as possibly answering it (research §2). Never changes the offering. */
export const requestLink = pgTable(
  'request_link',
  {
    id: uuid().primaryKey().defaultRandom(),
    requestId: uuid()
      .notNull()
      .references(() => request.id, { onDelete: 'cascade' }),
    offeringId: uuid()
      .notNull()
      .references(() => offering.id, { onDelete: 'cascade' }),
    /** The helper, or the asker linking an offering they found. */
    linkedById: uuid().references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    unique('request_link_once').on(t.requestId, t.offeringId),
    index('request_link_offering_idx').on(t.offeringId)
  ]
);
