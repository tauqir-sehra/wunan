// Threads of messages (001 FR-018 to FR-020). Each belongs to exactly one arrangement (its two
// members, 002 FR-022; one for its whole life, 004) or one problem report (reporter, reported member, and mediators).
import { sql } from 'drizzle-orm';
import { check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { arrangement } from './arrangements.ts';
import { member } from './members.ts';
import { problemReport } from './reports.ts';

export const conversation = pgTable(
  'conversation',
  {
    id: uuid().primaryKey().defaultRandom(),
    arrangementId: uuid()
      .unique()
      .references(() => arrangement.id, { onDelete: 'cascade' }),
    /** Set for mediation threads (asking for help with an agreement). */
    problemReportId: uuid().references(() => problemReport.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Time of the latest message. */
    lastMessageAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('conversation_has_one_owner', sql`(${t.arrangementId} is null) <> (${t.problemReportId} is null)`)]
);

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

export const messageKind = pgEnum('message_kind', [
  'text',
  'call_accepted',
  'system',
  // Notes written by the API when an arrangement changes (002 FR-016, FR-020, FR-022a; 004). The
  // arrangement's timeline is built from them.
  'asked',
  'detail_changed',
  'accepted',
  'declined',
  'withdrawn',
  'closed',
  'returned',
  'done',
  'not_done',
  'messages_shared'
]);

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
    body: text().notNull().default(''),
    /** Contact details added to the message: a snapshot of exactly what the author chose (FR-019). */
    sharedPhone: text(),
    sharedEmail: text(),
    /** A suggested time to call on a text message, or the accepted time on `call_accepted` (FR-020). */
    proposedTime: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('message_body_length', sql`char_length(${t.body}) <= 4000`),
    index('message_conversation_created_idx').on(t.conversationId, t.createdAt)
  ]
);
