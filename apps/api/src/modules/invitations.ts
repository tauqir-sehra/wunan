// Invitations and joining (FR-001, FR-001b, FR-002; data-model.md "invitation").
//
// How joining works:
// 1. A member creates an invitation and shares the link (only a hash of its token is stored).
// 2. The invitee signs up from the link: an unconfirmed account is created and the invitation is
//    held for them for 7 days while a confirmation link is emailed.
// 3. Opening the confirmation link confirms the email, marks the invitation used, and signs in.
// If the hold passes first, the unconfirmed account is deleted and the invitation is free again.
// Starting again from the same link (e.g., after a mistyped email) replaces the unconfirmed account.
import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, inArray, like, lt } from 'drizzle-orm';
import { auth } from '../auth.ts';
import { config } from '../config.ts';
import { db } from '../db/index.ts';
import { invitation, member, notificationPreference, notificationTypes, verification } from '../db/schema/index.ts';
import { ApiError } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { sendEmail } from '../notify/email.ts';
import { createAccount, shownName } from './members.ts';

const DAY = 24 * 60 * 60_000;
const INVITATION_LIFETIME = 14 * DAY;
const HOLD = 7 * DAY;
const CONFIRM_PREFIX = 'join-confirm:';

const notValid = () =>
  new ApiError(
    404,
    'invitation_not_valid',
    'This invitation link is no longer valid. Please ask the person who sent it for a new link.'
  );
const confirmationNotValid = () =>
  new ApiError(
    404,
    'confirmation_not_valid',
    'This link has run out or was already used. Use your invitation link again, or ask the person who invited you for a new link.'
  );

const newToken = () => randomBytes(32).toString('base64url');
const hash = (token: string) => createHash('sha256').update(token).digest('hex');

export async function createInvitation(inviterId: string) {
  await checkRateLimit(`invite:create:${inviterId}`, 20, 24 * 60);
  const token = newToken();
  const [created] = await db
    .insert(invitation)
    .values({ tokenHash: hash(token), inviterId, expiresAt: new Date(Date.now() + INVITATION_LIFETIME) })
    .returning();
  if (!created) throw new Error('Invitation was not created');
  // The raw link is returned only here, once.
  return { id: created.id, link: `${config.SITE_URL}/join/${token}`, expiresAt: created.expiresAt.toISOString() };
}

/** Whether a link can be used to sign up (also while waiting for confirmation, to start over). */
export async function checkInvitation(token: string) {
  await releaseExpiredHolds();
  const [row] = await db
    .select({ status: invitation.status, expiresAt: invitation.expiresAt, inviterName: member.displayName, inviterDeletedAt: member.deletedAt })
    .from(invitation)
    .innerJoin(member, eq(member.id, invitation.inviterId))
    .where(eq(invitation.tokenHash, hash(token)));
  const usable = row && (row.status === 'unused' || row.status === 'pending_confirmation') && row.expiresAt > new Date();
  if (!usable) throw notValid();
  return { valid: true as const, inviterName: shownName({ displayName: row.inviterName, deletedAt: row.inviterDeletedAt }) };
}

type SignUp = { email: string; displayName: string; password: string; emailNotifications: boolean };

export async function startAcceptance(token: string, details: SignUp, visitorAddress: string) {
  const tokenHash = hash(token);
  // Limits stop one link (or one visitor) from being used to send lots of email.
  await checkRateLimit(`accept:invitation:${tokenHash}`, 5, 24 * 60);
  await checkRateLimit(`accept:ip:${visitorAddress}`, config.E2E_RELAXED_LIMITS ? 1000 : 10, 60);
  await releaseExpiredHolds();

  const email = details.email.trim().toLowerCase();
  const confirmToken = newToken();
  const holdEnds = new Date(Date.now() + HOLD);

  const { inviterName } = await db.transaction(async (tx) => {
    // Lock the invitation so two sign-ups on one link can't both succeed.
    const [inv] = await tx.select().from(invitation).where(eq(invitation.tokenHash, tokenHash)).for('update');
    const usable = inv && (inv.status === 'unused' || inv.status === 'pending_confirmation') && inv.expiresAt > new Date();
    if (!inv || !usable) throw notValid();

    // Starting over on a held invitation replaces the earlier unconfirmed account.
    if (inv.status === 'pending_confirmation' && inv.usedById) {
      await deleteUnconfirmedMember(tx, inv.usedById);
    }

    const [existing] = await tx.select({ id: member.id }).from(member).where(eq(member.email, email));
    if (existing) {
      throw new ApiError(409, 'email_taken', 'That email already has an account. Try signing in instead.', {
        email: 'That email already has an account. Try signing in instead.'
      });
    }

    const created = await createAccount(
      { email, displayName: details.displayName, password: details.password, invitedById: inv.inviterId },
      tx
    );
    await tx.insert(notificationPreference).values(
      notificationTypes.map((type) => ({ memberId: created.id, type, email: details.emailNotifications }))
    );
    await tx
      .update(invitation)
      .set({ status: 'pending_confirmation', reservedUntil: holdEnds, usedById: created.id })
      .where(eq(invitation.id, inv.id));
    await tx.insert(verification).values({
      identifier: CONFIRM_PREFIX + hash(confirmToken),
      value: created.id,
      expiresAt: holdEnds
    });
    const [inviter] = await tx.select().from(member).where(eq(member.id, inv.inviterId));
    return { inviterName: inviter ? shownName(inviter) : 'A member' };
  });

  await sendConfirmationEmail(email, inviterName, confirmToken);
  return { status: 'check_your_email' as const };
}

/** Opens the emailed link: confirms the email, uses up the invitation, and signs the member in. */
export async function confirmAcceptance(token: string) {
  const memberId = await db.transaction(async (tx) => {
    const [pending] = await tx
      .select()
      .from(verification)
      .where(eq(verification.identifier, CONFIRM_PREFIX + hash(token)))
      .for('update');
    if (!pending || pending.expiresAt <= new Date()) throw confirmationNotValid();

    const [inv] = await tx
      .select()
      .from(invitation)
      .where(and(eq(invitation.usedById, pending.value), eq(invitation.status, 'pending_confirmation')))
      .for('update');
    // The hold, not the invitation's own 14-day expiry, decides whether confirming still works.
    if (!inv || !inv.reservedUntil || inv.reservedUntil <= new Date()) throw confirmationNotValid();

    await tx.update(member).set({ emailVerified: true, updatedAt: new Date() }).where(eq(member.id, pending.value));
    await tx.update(invitation).set({ status: 'used', reservedUntil: null }).where(eq(invitation.id, inv.id));
    await tx.delete(verification).where(eq(verification.value, pending.value));
    return pending.value;
  });

  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(memberId);
  const [joined] = await db.select().from(member).where(eq(member.id, memberId));
  return { token: session.token, member: { id: memberId, displayName: joined?.displayName ?? '' } };
}

/**
 * Sends a fresh confirmation link if the email belongs to an unconfirmed account still within its
 * hold. Always answers the same way, so it reveals nothing about who has signed up.
 */
export async function resendConfirmation(email: string) {
  const address = email.trim().toLowerCase();
  await checkRateLimit(`resend:${address}`, 3, 60);
  const [row] = await db
    .select({ memberId: member.id, reservedUntil: invitation.reservedUntil, inviterId: invitation.inviterId })
    .from(member)
    .innerJoin(invitation, and(eq(invitation.usedById, member.id), eq(invitation.status, 'pending_confirmation')))
    .where(and(eq(member.email, address), eq(member.emailVerified, false)));

  if (row?.reservedUntil && row.reservedUntil > new Date()) {
    const token = newToken();
    await db.transaction(async (tx) => {
      await tx.delete(verification).where(eq(verification.value, row.memberId));
      // Same end date as the hold: resending never extends it.
      await tx.insert(verification).values({ identifier: CONFIRM_PREFIX + hash(token), value: row.memberId, expiresAt: row.reservedUntil! });
    });
    const [inviter] = await db.select().from(member).where(eq(member.id, row.inviterId));
    await sendConfirmationEmail(address, inviter ? shownName(inviter) : 'A member', token);
  }
  return { status: 'sent_if_waiting' as const };
}

export async function cancelInvitation(inviterId: string, invitationId: string) {
  const [updated] = await db
    .update(invitation)
    .set({ status: 'cancelled' })
    .where(and(eq(invitation.id, invitationId), eq(invitation.inviterId, inviterId), eq(invitation.status, 'unused')))
    .returning({ id: invitation.id });
  if (!updated) {
    throw new ApiError(404, 'not_found', 'That invitation could not be cancelled. It may already be used or cancelled.');
  }
}

export async function listMyInvitations(inviterId: string) {
  await releaseExpiredHolds();
  const rows = await db
    .select({
      id: invitation.id,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      usedById: member.id,
      usedByName: member.displayName,
      usedByDeletedAt: member.deletedAt
    })
    .from(invitation)
    .leftJoin(member, eq(member.id, invitation.usedById))
    .where(eq(invitation.inviterId, inviterId))
    .orderBy(desc(invitation.createdAt));
  const now = new Date();
  return rows.map((row) => {
    const status =
      row.status === 'used' ? 'used'
      : row.status === 'cancelled' ? 'cancelled'
      : row.status === 'pending_confirmation' ? 'waiting'
      : row.expiresAt <= now ? 'expired'
      : 'unused';
    return {
      id: row.id,
      status,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      usedBy:
        status === 'used' && row.usedById && row.usedByName
          ? { id: row.usedById, displayName: shownName({ displayName: row.usedByName, deletedAt: row.usedByDeletedAt }) }
          : null
    } as const;
  });
}

/**
 * Deletes unconfirmed accounts whose hold has passed and frees their invitations, so the same
 * email can try again and unconfirmed personal data is not kept (data-model.md "Expired holds").
 */
export async function releaseExpiredHolds() {
  await db.transaction(async (tx) => {
    const expired = await tx
      .select({ id: invitation.id, usedById: invitation.usedById })
      .from(invitation)
      .where(and(eq(invitation.status, 'pending_confirmation'), lt(invitation.reservedUntil, new Date())))
      .for('update', { skipLocked: true });
    if (expired.length === 0) return;
    for (const row of expired) {
      if (row.usedById) await deleteUnconfirmedMember(tx, row.usedById);
    }
    await tx
      .update(invitation)
      .set({ status: 'unused', reservedUntil: null, usedById: null })
      .where(inArray(invitation.id, expired.map((row) => row.id)));
  });
  // Confirmation tokens whose hold ended (their accounts are gone).
  await db.delete(verification).where(and(like(verification.identifier, `${CONFIRM_PREFIX}%`), lt(verification.expiresAt, new Date())));
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Removes an unconfirmed account and everything attached to it (sessions, settings, tokens). */
async function deleteUnconfirmedMember(tx: Tx, memberId: string) {
  await tx.update(invitation).set({ usedById: null }).where(eq(invitation.usedById, memberId));
  await tx.delete(verification).where(eq(verification.value, memberId));
  // Cascades remove sessions, password, and notification settings. Only unconfirmed accounts.
  await tx.delete(member).where(and(eq(member.id, memberId), eq(member.emailVerified, false)));
}

async function sendConfirmationEmail(to: string, inviterName: string, token: string) {
  await sendEmail({
    to,
    subject: 'Please confirm your email to join wunan',
    text:
      `${inviterName} invited you to join their community on wunan.\n\n` +
      `To finish joining, open this link within 7 days:\n` +
      `${config.SITE_URL}/join/confirm/${token}\n\n` +
      `If you didn't sign up, you can ignore this email and nothing will happen.`
  });
}

/** Exposed for tests, which need to find an invitation from its link. */
export const hashToken = hash;
