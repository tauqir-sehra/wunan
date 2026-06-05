// Members: creating accounts, profiles, the invite chain, private contact details, and passwords
// (FR-001 to FR-005, FR-019). Profiles never include email or contact details.
import { and, asc, eq, inArray, notExists, sql as rawSql } from 'drizzle-orm';
import { auth } from '../auth.ts';
import { db } from '../db/index.ts';
import {
  account,
  agreement,
  invitation,
  listing,
  listingPhoto,
  member,
  message,
  notificationLog,
  notificationPreference,
  pushSubscription,
  session,
  verification
} from '../db/schema/index.ts';
import { decryptOptional, encryptOptional } from '../lib/crypto.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { deletePhotoFiles } from './photos.ts';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type NewAccount = {
  email: string;
  displayName: string;
  password: string;
  isFounder?: boolean;
  invitedById?: string | null;
  emailVerified?: boolean;
};

/**
 * Creates a member with a password. Better Auth's public sign-up route is disabled, so accounts
 * are inserted here directly (with Better Auth's own password hashing). Pass `tx` to create the
 * account inside a larger transaction, e.g. while holding an invitation.
 * Callers are responsible for the invitation rules; this only creates the account.
 */
export async function createAccount(details: NewAccount, tx: Tx | typeof db = db) {
  if (details.password.length < 10 || details.password.length > 128) {
    throw new ApiError(400, 'validation_failed', 'Some details need fixing.', {
      password: 'Please choose a password of 10 to 128 characters.'
    });
  }
  const ctx = await auth.$context;
  const passwordHash = await ctx.password.hash(details.password);
  const [created] = await tx
    .insert(member)
    .values({
      email: details.email.trim().toLowerCase(),
      displayName: details.displayName.trim(),
      emailVerified: details.emailVerified ?? false,
      isFounder: details.isFounder ?? false,
      invitedById: details.invitedById ?? null
    })
    .returning();
  if (!created) throw new Error('Member was not created');
  await tx.insert(account).values({
    userId: created.id,
    accountId: created.id,
    providerId: 'credential',
    password: passwordHash
  });
  return created;
}

/** How a member's name is shown everywhere, including after they leave. */
export function shownName(row: { displayName: string; deletedAt: Date | null }) {
  return row.deletedAt ? `${row.displayName} (no longer a member)` : row.displayName;
}

const ref = (row: { id: string; displayName: string; deletedAt: Date | null }) => ({
  id: row.id,
  displayName: shownName(row)
});

export async function getProfile(memberId: string) {
  const [row] = await db.select().from(member).where(eq(member.id, memberId));
  // Unconfirmed sign-ups are not members yet, so they have no profile.
  if (!row || !row.emailVerified) throw errors.notFound('That member');

  const inviter = row.invitedById
    ? (await db.select().from(member).where(eq(member.id, row.invitedById)))[0]
    : undefined;
  const invitees = await db
    .select({ id: member.id, displayName: member.displayName, deletedAt: member.deletedAt })
    .from(member)
    .where(and(eq(member.invitedById, row.id), eq(member.emailVerified, true)))
    .orderBy(asc(member.createdAt));

  return {
    id: row.id,
    displayName: shownName(row),
    bio: row.deletedAt ? null : row.bio,
    joinedAt: row.createdAt.toISOString(),
    isFounder: row.isFounder,
    isFormerMember: row.deletedAt !== null,
    invitedBy: inviter ? ref(inviter) : null,
    invitees: invitees.map(ref)
  };
}

/** The invite chain from this member up to a founding member (FR-004). */
export async function getChain(memberId: string) {
  const rows = await db.execute<{ id: string; display_name: string; deleted_at: string | null; is_founder: boolean; depth: number }>(rawSql`
    with recursive chain as (
      select id, display_name, deleted_at, is_founder, invited_by_id, 0 as depth
        from member where id = ${memberId} and email_verified
      union all
      select m.id, m.display_name, m.deleted_at, m.is_founder, m.invited_by_id, chain.depth + 1
        from member m join chain on m.id = chain.invited_by_id
       where chain.depth < 1000
    )
    select id, display_name, deleted_at, is_founder, depth from chain order by depth`);
  if (rows.length === 0) throw errors.notFound('That member');
  return {
    chain: rows.map((row) => ({
      ...ref({ id: row.id, displayName: row.display_name, deletedAt: row.deleted_at ? new Date(row.deleted_at) : null }),
      isFounder: row.is_founder
    }))
  };
}

export async function getMe(memberId: string) {
  const [row] = await db.select().from(member).where(eq(member.id, memberId));
  if (!row) throw errors.notSignedIn();
  return {
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    isFounder: row.isFounder,
    joinedAt: row.createdAt.toISOString()
  };
}

export async function updateMe(memberId: string, changes: { displayName?: string | undefined; bio?: string | null | undefined }) {
  const values: Partial<typeof member.$inferInsert> = { updatedAt: new Date() };
  if (changes.displayName !== undefined) values.displayName = changes.displayName;
  if (changes.bio !== undefined) values.bio = changes.bio;
  await db.update(member).set(values).where(eq(member.id, memberId));
  return getMe(memberId);
}

/** My private contact details, decrypted (only ever returned to me). */
export async function getContact(memberId: string) {
  const [row] = await db
    .select({ sharePhone: member.sharePhone, shareEmail: member.shareEmail })
    .from(member)
    .where(eq(member.id, memberId));
  return { sharePhone: decryptOptional(row?.sharePhone), shareEmail: decryptOptional(row?.shareEmail) };
}

export async function updateContact(memberId: string, details: { sharePhone: string | null; shareEmail: string | null }) {
  await db
    .update(member)
    .set({
      sharePhone: encryptOptional(details.sharePhone),
      shareEmail: encryptOptional(details.shareEmail),
      updatedAt: new Date()
    })
    .where(eq(member.id, memberId));
  return getContact(memberId);
}

/** Changes the password after checking the current one, and signs out other devices. */
export async function changePassword(memberId: string, currentSessionToken: string, currentPassword: string, newPassword: string) {
  await requirePassword(memberId, currentPassword, 'currentPassword');
  const ctx = await auth.$context;
  await ctx.internalAdapter.updatePassword(memberId, await ctx.password.hash(newPassword));
  // Other devices must sign in again with the new password; this one stays signed in.
  await db
    .delete(session)
    .where(and(eq(session.userId, memberId), rawSql`${session.token} <> ${currentSessionToken}`));
}

/** Checks a member's password, reporting a wrong one against the given form field. */
async function requirePassword(memberId: string, password: string, field: string) {
  // Someone holding a member's session can't use these forms to guess the password.
  await checkRateLimit(`password-check:${memberId}`, 10, 60);
  const ctx = await auth.$context;
  const [credential] = await db
    .select()
    .from(account)
    .where(and(eq(account.userId, memberId), eq(account.providerId, 'credential')));
  const valid = credential?.password && (await ctx.password.verify({ hash: credential.password, password }));
  if (!valid) {
    throw new ApiError(400, 'validation_failed', 'Some details need fixing.', {
      [field]: "That isn't your current password. Please try again."
    });
  }
}

const CONTACT_REMOVED = 'Contact details were removed when this member left wunan.';

/**
 * Leaving wunan (FR-032, research §16). Keeps only the display name, so invite chains and the
 * agreements other members took part in still make sense; shown as "<name> (no longer a member)".
 *
 * - Personal fields, contact details, the password, sessions, devices, and notification
 *   settings are removed. The email is replaced, so it can be used to join again later.
 * - Listings are deleted with their photos. A listing that is part of an agreement keeps only
 *   its title and kind, closed, so the other member's agreement still says what it was about.
 * - Contact details this member shared in conversations are replaced with a short note.
 * - Messages, agreements, and requests for help stay visible to the other members involved.
 * - Unused invitation links stop working.
 */
export async function deleteAccount(memberId: string, password: string) {
  await requirePassword(memberId, password, 'password');

  const photoKeys = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(member).where(eq(member.id, memberId)).for('update');
    if (!row || row.deletedAt) throw errors.notSignedIn();

    const myListings = tx.select({ id: listing.id }).from(listing).where(eq(listing.ownerId, memberId));
    const photos = await tx
      .delete(listingPhoto)
      .where(inArray(listingPhoto.listingId, myListings))
      .returning({ fileKey: listingPhoto.fileKey });

    const withoutAgreements = and(
      eq(listing.ownerId, memberId),
      notExists(tx.select({ one: rawSql`1` }).from(agreement).where(eq(agreement.listingId, listing.id)))
    );
    await tx.delete(listing).where(withoutAgreements);
    await tx
      .update(listing)
      .set({ description: null, area: null, status: 'closed', closedReason: 'removed', updatedAt: new Date() })
      .where(eq(listing.ownerId, memberId));

    await tx
      .update(message)
      .set({ body: CONTACT_REMOVED })
      .where(and(eq(message.authorId, memberId), eq(message.kind, 'contact_shared')));

    await tx
      .update(invitation)
      .set({ status: 'cancelled' })
      .where(and(eq(invitation.inviterId, memberId), eq(invitation.status, 'unused')));

    await tx.delete(pushSubscription).where(eq(pushSubscription.memberId, memberId));
    await tx.delete(notificationPreference).where(eq(notificationPreference.memberId, memberId));
    await tx.delete(notificationLog).where(eq(notificationLog.memberId, memberId));
    await tx.delete(session).where(eq(session.userId, memberId));
    await tx.delete(account).where(eq(account.userId, memberId));
    // Password-reset and confirmation links belonging to this member.
    await tx.delete(verification).where(eq(verification.value, memberId));

    await tx
      .update(member)
      .set({
        email: `deleted-${memberId}@deleted.invalid`,
        bio: null,
        image: null,
        sharePhone: null,
        shareEmail: null,
        deletedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(member.id, memberId));
    return photos.map((p) => p.fileKey);
  });

  // Files are removed after the rows, so a failure here never leaves rows pointing at nothing.
  await deletePhotoFiles(photoKeys);
}
