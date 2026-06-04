// wunan's own rate-limit counters (messages, invitations, flags, joining). One row per attempt.
import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const rateLimitEvent = pgTable(
  'rate_limit_event',
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('rate_limit_event_key_idx').on(t.key, t.createdAt)]
);
