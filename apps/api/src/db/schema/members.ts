// Members and the tables Better Auth needs (sessions, password accounts, one-time tokens,
// sign-in rate limits). Better Auth's "user" model is named `member` here.
// There is deliberately no field for removal, suspension, penalties, or blocking (FR-029b).
import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  bigint,
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow()
};

export const member = pgTable(
  'member',
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull().unique(),
    emailVerified: boolean().notNull().default(false),
    displayName: text().notNull(),
    image: text(), // Required by Better Auth's schema; wunan does not use member photos.
    bio: text(),
    invitedById: uuid().references((): AnyPgColumn => member.id),
    // Everyone from this member's founding member down to this member, in order (005). Written once
    // on joining and never updated: nobody's inviter ever changes, and members who leave keep their row.
    inviteLine: uuid().array().notNull(),
    isFounder: boolean().notNull().default(false),
    // Private contact details, stored encrypted (lib/crypto.ts). Revealed only by contact sharing.
    sharePhone: text(),
    shareEmail: text(),
    deletedAt: timestamp({ withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('member_display_name_length', sql`char_length(${t.displayName}) between 1 and 60`),
    check('member_bio_length', sql`${t.bio} is null or char_length(${t.bio}) <= 500`),
    // Everyone except founders was invited by someone (FR-001).
    check('member_inviter_or_founder', sql`${t.isFounder} or ${t.invitedById} is not null`),
    // The invite line ends with this member, and the person before them is their inviter (005).
    check(
      'member_invite_line_ends_with_self',
      sql`${t.inviteLine}[cardinality(${t.inviteLine})] = ${t.id}`
    ),
    check(
      'member_invite_line_matches_inviter',
      sql`(${t.isFounder} and ${t.invitedById} is null and cardinality(${t.inviteLine}) = 1)
        or (${t.invitedById} is not null and cardinality(${t.inviteLine}) >= 2
            and ${t.inviteLine}[cardinality(${t.inviteLine}) - 1] = ${t.invitedById})`
    ),
    index('member_invited_by_idx').on(t.invitedById)
  ]
);

export const session = pgTable(
  'session',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    token: text().notNull().unique(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    ...timestamps
  },
  (t) => [index('session_user_idx').on(t.userId)]
);

export const account = pgTable(
  'account',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => member.id, { onDelete: 'cascade' }),
    accountId: text().notNull(),
    providerId: text().notNull(),
    password: text(), // Password hash (scrypt), managed by Better Auth.
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: timestamp({ withTimezone: true }),
    refreshTokenExpiresAt: timestamp({ withTimezone: true }),
    scope: text(),
    ...timestamps
  },
  (t) => [index('account_user_idx').on(t.userId)]
);

/** One-time tokens: password resets (Better Auth) and email confirmations (invitations module). */
export const verification = pgTable(
  'verification',
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ...timestamps
  },
  (t) => [index('verification_identifier_idx').on(t.identifier)]
);

/** Better Auth's sign-in and password-reset rate limits, kept in the database. */
export const rateLimit = pgTable('rate_limit', {
  id: uuid().primaryKey().defaultRandom(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: 'number' }).notNull()
});
