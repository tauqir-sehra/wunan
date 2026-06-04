// Notification settings per member and type, plus a log used to keep notifications infrequent.
import { boolean, index, pgEnum, pgTable, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { member } from './members.ts';

export const notificationTypes = ['message', 'agreement', 'reminder', 'report', 'flag'] as const;
export type NotificationType = (typeof notificationTypes)[number];
export const notificationType = pgEnum('notification_type', notificationTypes);

/** Both channels are off until the member turns them on (FR-031, constitution V). */
export const notificationPreference = pgTable(
  'notification_preference',
  {
    id: uuid().primaryKey().defaultRandom(),
    memberId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    type: notificationType().notNull(),
    email: boolean().notNull().default(false),
    device: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [unique('notification_preference_member_type').on(t.memberId, t.type)]
);

/** What was sent and when, so a conversation notifies a member at most once per hour. */
export const notificationLog = pgTable(
  'notification_log',
  {
    id: uuid().primaryKey().defaultRandom(),
    memberId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    type: notificationType().notNull(),
    conversationId: uuid(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('notification_log_lookup_idx').on(t.memberId, t.conversationId, t.sentAt)]
);
