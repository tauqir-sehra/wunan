// Public threads (003 FR-023): short messages on a request or an offering that every member can read
// and post in. Kept apart from private conversations on purpose (research §7). Only the author can
// remove a message; its body is then emptied and it shows as "Message removed".
import { sql } from 'drizzle-orm';
import { check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { offering } from './offerings.ts';
import { member } from './members.ts';
import { request } from './requests.ts';

export const publicMessage = pgTable(
  'public_message',
  {
    id: uuid().primaryKey().defaultRandom(),
    requestId: uuid().references(() => request.id, { onDelete: 'cascade' }),
    offeringId: uuid().references(() => offering.id, { onDelete: 'cascade' }),
    authorId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    body: text().notNull(),
    removedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('public_message_one_subject', sql`(${t.requestId} is null) <> (${t.offeringId} is null)`),
    check('public_message_body_length', sql`${t.removedAt} is not null or char_length(${t.body}) between 1 and 240`),
    index('public_message_request_idx').on(t.requestId, t.createdAt),
    index('public_message_offering_idx').on(t.offeringId, t.createdAt),
    index('public_message_author_idx').on(t.authorId)
  ]
);
