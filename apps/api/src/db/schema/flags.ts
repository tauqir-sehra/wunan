// Flags: a member's written request to whoever can act on something: an offering's owner, a
// request's asker, or a public message's author (001 FR-013a; 003 research §8). A flag never
// hides or changes anything.
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { offering } from './offerings.ts';
import { member } from './members.ts';
import { publicMessage } from './public-messages.ts';
import { request } from './requests.ts';

export const flag = pgTable(
  'flag',
  {
    id: uuid().primaryKey().defaultRandom(),
    offeringId: uuid().references(() => offering.id, { onDelete: 'cascade' }),
    requestId: uuid().references(() => request.id, { onDelete: 'cascade' }),
    publicMessageId: uuid().references(() => publicMessage.id, { onDelete: 'cascade' }),
    flaggedById: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    request: text().notNull(),
    /** When the recipient (owner, asker, or author) saw it. */
    seenAt: timestamp({ withTimezone: true }),
    /** When the recipient pressed the Home line covering this; null: still listed (007). Independent of `seenAt`. */
    homePressedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('flag_one_subject', sql`num_nonnulls(${t.offeringId}, ${t.requestId}, ${t.publicMessageId}) = 1`),
    check('flag_request_length', sql`char_length(${t.request}) between 1 and 500`),
    index('flag_offering_idx').on(t.offeringId),
    index('flag_request_idx').on(t.requestId),
    index('flag_public_message_idx').on(t.publicMessageId)
  ]
);
