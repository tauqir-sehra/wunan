// Invitations: the only way to join (FR-001, FR-002). Only a hash of the token is stored; the raw
// token exists only in the link the inviter shares.
import { index, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { member } from './members.ts';

/**
 * unused → pending_confirmation (someone signed up, waiting for their email confirmation)
 *        → used; unused → cancelled. "Expired" is not stored: it is `expires_at` in the past.
 */
export const invitationStatus = pgEnum('invitation_status', [
  'unused',
  'pending_confirmation',
  'used',
  'cancelled'
]);

export const invitation = pgTable(
  'invitation',
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenHash: text().notNull().unique(),
    inviterId: uuid()
      .notNull()
      .references(() => member.id),
    status: invitationStatus().notNull().default('unused'),
    /** While waiting for confirmation: the hold ends here (now + 7 days at sign-up). */
    reservedUntil: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    /** The member who signed up with it (unconfirmed while pending, confirmed once used). */
    usedById: uuid().references(() => member.id, { onDelete: 'set null' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('invitation_inviter_idx').on(t.inviterId)]
);
