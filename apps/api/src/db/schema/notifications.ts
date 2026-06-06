// Notification settings per member and type, the devices that receive them, and a log used to
// keep notifications infrequent.
import { sql } from 'drizzle-orm';
import { boolean, check, index, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';
import { member } from './members.ts';

export const notificationTypes = ['message', 'agreement', 'reminder', 'report', 'flag', 'request', 'public_message'] as const;
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
    /** A request or offering: keeps public thread and request notices infrequent (003 FR-023e). */
    subjectId: uuid(),
    sentAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('notification_log_lookup_idx').on(t.memberId, t.conversationId, t.sentAt),
    index('notification_log_subject_idx').on(t.memberId, t.subjectId, t.sentAt)
  ]
);

/** `web` now; other values (e.g., `unifiedpush`) are reserved for future native clients. */
export const pushPlatform = pgEnum('push_platform', ['web']);

/**
 * A device that receives notifications. Removed when the member turns it off, when the push
 * service says it is gone, or when the member leaves wunan.
 */
export const pushSubscription = pgTable(
  'push_subscription',
  {
    id: uuid().primaryKey().defaultRandom(),
    memberId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    platform: pushPlatform().notNull().default('web'),
    endpoint: text().notNull().unique(),
    p256dh: text(),
    auth: text(),
    /** Shown in Settings ("iPhone Safari") so the member can recognise and remove it. */
    label: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('push_subscription_member_idx').on(t.memberId),
    check('push_subscription_web_keys', sql`${t.platform} <> 'web' or (${t.p256dh} is not null and ${t.auth} is not null)`),
    check('push_subscription_label_length', sql`char_length(${t.label}) between 1 and 60`)
  ]
);
