// Conversations and messages between members (FR-018 to FR-020). A conversation is usually two
// members, optionally about a listing; mediation conversations (US6) have three or more.
import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { listing } from './listings.ts';
import { member } from './members.ts';

export const conversation = pgTable('conversation', {
  id: uuid().primaryKey().defaultRandom(),
  listingId: uuid().references(() => listing.id, { onDelete: 'set null' }),
  /** Set for mediation conversations; its foreign key is added with problem reports (US6). */
  problemReportId: uuid(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  /** Time of the latest message, for ordering the conversation list. */
  lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow()
});

export const conversationParticipant = pgTable(
  'conversation_participant',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    memberId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    lastReadAt: timestamp({ withTimezone: true })
  },
  (t) => [
    unique('conversation_participant_pair').on(t.conversationId, t.memberId),
    index('conversation_participant_member_idx').on(t.memberId)
  ]
);

export const messageKind = pgEnum('message_kind', ['text', 'contact_shared', 'call_proposed', 'call_accepted', 'system']);

export const message = pgTable(
  'message',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => conversation.id, { onDelete: 'cascade' }),
    /** Must be a participant (checked in modules/messaging.ts). Null for system messages. */
    authorId: uuid().references(() => member.id, { onDelete: 'set null' }),
    kind: messageKind().notNull().default('text'),
    /** For `contact_shared`: a snapshot of exactly what the author confirmed. */
    body: text().notNull().default(''),
    /** For call proposals and acceptances (FR-020). */
    proposedTime: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('message_body_length', sql`char_length(${t.body}) <= 4000`),
    index('message_conversation_created_idx').on(t.conversationId, t.createdAt)
  ]
);
