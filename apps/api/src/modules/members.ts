// Members: creating accounts, profiles, how two members are connected, private contact details, and passwords
// (FR-001 to FR-005, FR-019). Profiles never include email or contact details.
import { and, asc, eq, inArray, isNotNull, notExists, or, sql as rawSql } from 'drizzle-orm';
import { auth } from '../auth.ts';
import { db } from '../db/index.ts';
import {
  account,
  arrangement,
  invitation,
  offering,
  offeringPhoto,
  member,
  message,
  notificationLog,
  notificationPreference,
  publicMessage,
  pushSubscription,
  request,
  session,
  verification
} from '../db/schema/index.ts';
import { decryptOptional, encryptOptional } from '../lib/crypto.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { connectionOf } from './connection.ts';
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
  // The invite line is the inviter's line plus this member (005); founders start their own.
  const id = crypto.randomUUID();
  let inviteLine: string[] = [id];
  if (details.invitedById) {
    const [inviter] = await tx
      .select({ inviteLine: member.inviteLine })
      .from(member)
      .where(eq(member.id, details.invitedById));
    if (!inviter) throw new Error('Inviter not found');
    inviteLine = [...inviter.inviteLine, id];
  }
  const [created] = await tx
    .insert(member)
    .values({
      id,
      inviteLine,
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

/**
 * A member's profile, as seen by `viewerId`. One query reads everyone on the two invite lines (which
 * include both members and the profile's inviter), so the connection costs no recursion (005).
 */
export async function getProfile(memberId: string, viewerId: string) {
  const ends = db
    .select({ id: rawSql<string>`unnest(${member.inviteLine})`.as('id') })
    .from(member)
    .where(inArray(member.id, [memberId, viewerId]));
  const people = await db
    .select({
      id: member.id,
      displayName: member.displayName,
      deletedAt: member.deletedAt,
      isFounder: member.isFounder,
      emailVerified: member.emailVerified,
      inviteLine: member.inviteLine,
      bio: member.bio,
      createdAt: member.createdAt
    })
    .from(member)
    .where(inArray(member.id, ends));
  const byId = new Map(people.map((p) => [p.id, p]));
  const row = byId.get(memberId);
  const viewer = byId.get(viewerId);
  // Unconfirmed sign-ups are not members yet, so they have no profile.
  if (!row || !row.emailVerified || !viewer) throw errors.notFound('That member');

  const invitees = await db
    .select({ id: member.id, displayName: member.displayName, deletedAt: member.deletedAt })
    .from(member)
    .where(and(eq(member.invitedById, row.id), eq(member.emailVerified, true)))
    .orderBy(asc(member.createdAt));

  const person = (id: string) => {
    const p = byId.get(id)!;
    return { ...ref(p), isFounder: p.isFounder, isFormerMember: p.deletedAt !== null };
  };
  const inviterId = row.inviteLine.at(-2);
  const connection = connectionOf(viewer.inviteLine, row.inviteLine);

  return {
    id: row.id,
    displayName: shownName(row),
    bio: row.deletedAt ? null : row.bio,
    joinedAt: row.createdAt.toISOString(),
    isFounder: row.isFounder,
    isFormerMember: row.deletedAt !== null,
    invitedBy: inviterId ? ref(byId.get(inviterId)!) : null,
    invitees: invitees.map(ref),
    connection: {
      kind: connection.kind,
      top: connection.topId ? person(connection.topId) : null,
      toYou: connection.toYouIds.map(person),
      toThem: connection.toThemIds.map(person)
    }
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
 * - Offerings are deleted with their photos. An offering that is part of an agreement keeps only
 *   its title and kind, closed, so the other member's agreement still says what it was about.
 * - Contact details this member shared in conversations are replaced with a short note.
 * - Messages, agreements, and requests for help stay visible to the other members involved.
 * - Unused invitation links stop working, and open arrangements they made or received close.
 * - Their requests close and disappear for everyone (description and area cleared), and their
 *   public messages are deleted (003 FR-026). Offerings linked to their requests stay as they are.
 */
export async function deleteAccount(memberId: string, password: string) {
  await requirePassword(memberId, password, 'password');

  const photoKeys = await db.transaction(async (tx) => {
    const [row] = await tx.select().from(member).where(eq(member.id, memberId)).for('update');
    if (!row || row.deletedAt) throw errors.notSignedIn();

    const myOfferings = tx.select({ id: offering.id }).from(offering).where(eq(offering.ownerId, memberId));
    const photos = await tx
      .delete(offeringPhoto)
      .where(inArray(offeringPhoto.offeringId, myOfferings))
      .returning({ fileKey: offeringPhoto.fileKey });

    // Offerings someone asked for stay (title only), so their arrangements still say what
    // they were about; the others go.
    const unused = and(
      eq(offering.ownerId, memberId),
      notExists(tx.select({ one: rawSql`1` }).from(arrangement).where(eq(arrangement.offeringId, offering.id)))
    );
    await tx.delete(offering).where(unused);
    await tx
      .update(offering)
      .set({ description: null, area: null, meetingPlace: null, status: 'closed', closedReason: 'removed', updatedAt: new Date() })
      .where(eq(offering.ownerId, memberId));

    await tx
      .update(message)
      // A message that was only contact details says why it's now empty.
      .set({ sharedPhone: null, sharedEmail: null, body: rawSql`case when ${message.body} = '' then ${CONTACT_REMOVED} else ${message.body} end` })
      .where(and(eq(message.authorId, memberId), or(isNotNull(message.sharedPhone), isNotNull(message.sharedEmail))));

    await tx
      .update(request)
      .set({ status: 'closed', closedReason: 'account_deleted', closedByArrangementId: null, description: null, area: null, updatedAt: new Date() })
      .where(eq(request.askerId, memberId));
    await tx.delete(publicMessage).where(eq(publicMessage.authorId, memberId));

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
  // Open arrangements they made or received close, and the other member is told (002 FR-020a).
  await closeOpenArrangementsOf(memberId);
}

// Set by modules/arrangements.ts, which imports this module (a direct import would be circular).
let closeOpenArrangementsOf: (memberId: string) => Promise<void> = async () => {};
export function setArrangementCloser(closer: typeof closeOpenArrangementsOf) {
  closeOpenArrangementsOf = closer;
}
