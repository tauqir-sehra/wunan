// Agreements (FR-022 to FR-026; data-model.md "agreement" and "Effects on listing").
// The listing's owner records what was agreed; the listing updates in the same transaction, with
// the listing row locked so two agreements can never hand out more than is left. The other member
// confirms or disputes; the owner can cancel while it's still pending, which undoes the effects.
import type { CreateAgreement } from '@wunan/shared';
import { and, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { agreement, conversation, conversationParticipant, listing, member } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { notify } from '../notify/index.ts';
import { trimDecimal } from './listings.ts';
import { shownName } from './members.ts';

type AgreementRow = typeof agreement.$inferSelect;
type ListingRow = typeof listing.$inferSelect;

const outcomeFor = { lend: 'lent', gift: 'gifted', trade: 'traded', service: 'provided' } as const;
const needsFixing = (fields: Record<string, string>) => new ApiError(400, 'validation_failed', 'Some details need fixing.', fields);

/** Members who messaged the owner about this listing: the people an agreement can be with. */
export async function listCandidates(listingId: string, ownerId: string) {
  const [item] = await db.select().from(listing).where(eq(listing.id, listingId));
  if (!item) throw errors.notFound('That listing');
  if (item.ownerId !== ownerId) throw new ApiError(403, 'not_owner', 'Only the person who listed this can record an agreement.');
  const rows = await db
    .selectDistinct({ id: member.id, displayName: member.displayName, deletedAt: member.deletedAt })
    .from(conversation)
    .innerJoin(conversationParticipant, eq(conversationParticipant.conversationId, conversation.id))
    .innerJoin(member, eq(member.id, conversationParticipant.memberId))
    .where(and(eq(conversation.listingId, listingId), ne(member.id, ownerId), isNull(member.deletedAt)));
  return rows.map((row) => ({ id: row.id, displayName: shownName(row) }));
}

export async function recordAgreement(listingId: string, ownerId: string, input: CreateAgreement) {
  const created = await db.transaction(async (tx) => {
    const [item] = await tx.select().from(listing).where(eq(listing.id, listingId)).for('update');
    if (!item) throw errors.notFound('That listing');
    if (item.ownerId !== ownerId) throw new ApiError(403, 'not_owner', 'Only the person who listed this can record an agreement.');
    if (input.otherMemberId === ownerId) throw needsFixing({ otherMemberId: 'Please choose the other person in the agreement.' });
    if (item.status !== 'available') throw new ApiError(409, 'not_available', "This listing isn't available right now, so an agreement can't be recorded.");
    const [other] = await tx.select().from(member).where(eq(member.id, input.otherMemberId));
    if (!other || !other.emailVerified || other.deletedAt) throw needsFixing({ otherMemberId: 'Please choose who you agreed with.' });

    const values = { listingId, ownerId, otherMemberId: other.id, outcome: outcomeFor[item.type], note: input.note ?? null } as typeof agreement.$inferInsert;
    const changes: Partial<ListingRow> = { updatedAt: new Date() };

    switch (item.type) {
      case 'lend':
        // A loan covers the whole listing until it's marked returned.
        if (!input.returnDue) throw needsFixing({ returnDue: 'Please choose the return date.' });
        values.returnDue = input.returnDue;
        changes.status = 'lent_out';
        break;
      case 'gift':
      case 'trade':
        if (item.remaining === null) {
          changes.status = 'closed'; // Nothing measured, so the agreement uses it up.
          changes.closedReason = 'used_up';
          break;
        }
        if (!input.amount) throw needsFixing({ amount: 'Please say how much.' });
        if (Number(input.amount) > Number(item.remaining)) throw notEnough(item);
        values.amount = input.amount;
        break;
      case 'service': {
        const sessions = input.sessions ?? 1;
        if (item.sessionsRemaining !== null && sessions > item.sessionsRemaining) throw notEnough(item);
        values.sessions = sessions;
        break;
      }
    }

    const [saved] = await tx.insert(agreement).values(values).returning();
    if (values.amount) {
      // Calculated by PostgreSQL so decimals stay exact.
      await tx.update(listing).set({ remaining: sql`${listing.remaining} - ${values.amount}` }).where(eq(listing.id, listingId));
    }
    if (item.type === 'service' && item.sessionsRemaining !== null) {
      await tx.update(listing).set({ sessionsRemaining: sql`${listing.sessionsRemaining} - ${values.sessions}` }).where(eq(listing.id, listingId));
    }
    await tx.update(listing).set(changes).where(eq(listing.id, listingId));
    // Close automatically when nothing remains (FR-014, FR-010a).
    await tx
      .update(listing)
      .set({ status: 'closed', closedReason: 'used_up' })
      .where(and(eq(listing.id, listingId), eq(listing.status, 'available'), or(eq(listing.remaining, '0'), eq(listing.sessionsRemaining, 0))));
    return saved!;
  });

  const [owner] = await db.select().from(member).where(eq(member.id, ownerId));
  await notify(created.otherMemberId, 'agreement', {
    title: `${owner?.displayName ?? 'A member'} recorded an agreement with you`,
    body: 'Please have a look and confirm it, or say if something needs correcting.',
    url: `/agreements/${created.id}`
  });
  return getAgreement(created.id, ownerId);
}

function notEnough(item: ListingRow) {
  const left = item.type === 'service' ? `${item.sessionsRemaining} sessions` : `${trimDecimal(item.remaining)}`;
  return new ApiError(409, 'not_enough_remaining', `There isn't enough left for that. What's left: ${left}.`);
}

export async function confirmAgreement(agreementId: string, memberId: string, answer: 'confirmed' | 'disputed') {
  const row = await partyAgreement(agreementId, memberId);
  if (row.otherMemberId !== memberId) throw new ApiError(403, 'not_allowed', 'Only the other person in the agreement can answer this.');
  if (row.confirmation !== 'pending') throw new ApiError(409, 'already_answered', 'This agreement has already been answered.');
  await db.update(agreement).set({ confirmation: answer }).where(eq(agreement.id, agreementId));
  if (answer === 'disputed') {
    const [other] = await db.select().from(member).where(eq(member.id, memberId));
    await notify(row.ownerId, 'agreement', {
      title: `${other?.displayName ?? 'A member'} said an agreement needs a correction`,
      body: 'You can talk it over in your messages.',
      url: `/agreements/${agreementId}`
    });
  }
  return getAgreement(agreementId, memberId);
}

/** The owner marks a loan returned; the listing is available again (FR-025). */
export async function markReturned(agreementId: string, ownerId: string) {
  const row = await partyAgreement(agreementId, ownerId);
  if (row.ownerId !== ownerId) throw new ApiError(403, 'not_allowed', 'Only the owner can mark this returned.');
  if (row.outcome !== 'lent') throw new ApiError(400, 'not_a_loan', 'Only loans can be marked returned.');
  if (row.returnedAt || row.confirmation === 'cancelled') throw new ApiError(409, 'already_returned', 'This loan is already finished.');
  await db.transaction(async (tx) => {
    await tx.update(agreement).set({ returnedAt: new Date() }).where(eq(agreement.id, agreementId));
    await tx.update(listing).set({ status: 'available', updatedAt: new Date() }).where(and(eq(listing.id, row.listingId), eq(listing.status, 'lent_out')));
  });
  return getAgreement(agreementId, ownerId);
}

/** The owner undoes a pending agreement, e.g. a wrong amount (FR-024a). Reverses its effects. */
export async function cancelAgreement(agreementId: string, ownerId: string) {
  const row = await partyAgreement(agreementId, ownerId);
  if (row.ownerId !== ownerId) throw new ApiError(403, 'not_allowed', 'Only the owner can cancel this agreement.');
  if (row.confirmation !== 'pending') throw new ApiError(409, 'not_pending', 'Only an agreement that has not been answered yet can be cancelled.');
  await db.transaction(async (tx) => {
    await tx.select().from(listing).where(eq(listing.id, row.listingId)).for('update');
    await tx.update(agreement).set({ confirmation: 'cancelled' }).where(eq(agreement.id, agreementId));
    if (row.amount) await tx.update(listing).set({ remaining: sql`${listing.remaining} + ${row.amount}` }).where(eq(listing.id, row.listingId));
    if (row.sessions) {
      await tx
        .update(listing)
        .set({ sessionsRemaining: sql`${listing.sessionsRemaining} + ${row.sessions}` })
        .where(and(eq(listing.id, row.listingId), sql`${listing.sessionsRemaining} is not null`));
    }
    // Back to available if the agreement had lent it out or used it up (not if the owner removed it).
    await tx
      .update(listing)
      .set({ status: 'available', closedReason: null, updatedAt: new Date() })
      .where(and(eq(listing.id, row.listingId), or(eq(listing.status, 'lent_out'), eq(listing.closedReason, 'used_up'))));
  });
  const [owner] = await db.select().from(member).where(eq(member.id, ownerId));
  await notify(row.otherMemberId, 'agreement', {
    title: `${owner?.displayName ?? 'A member'} cancelled an agreement with you`,
    body: 'Nothing else changes. You can talk it over in your messages.',
    url: `/agreements/${agreementId}`
  });
  return getAgreement(agreementId, ownerId);
}

/** My history: given, received, lent, borrowed, provided (FR-026). */
export async function listMine(memberId: string) {
  const rows = await db
    .select()
    .from(agreement)
    .where(or(eq(agreement.ownerId, memberId), eq(agreement.otherMemberId, memberId)))
    .orderBy(desc(agreement.createdAt));
  return describe(rows, memberId);
}

export async function getAgreement(agreementId: string, memberId: string) {
  const row = await viewableAgreement(agreementId, memberId);
  return { ...(await describe([row], memberId))[0]!, reports: await reportsFor(agreementId) };
}

// Requests for help on an agreement are listed with it (set by modules/reports.ts).
let reportsFor: (agreementId: string) => Promise<{ id: string; status: 'open' | 'resolved'; outcomeNote: string | null }[]> = async () => [];
export function setReportsLookup(lookup: typeof reportsFor) {
  reportsFor = lookup;
}

/** Counts for home: agreements waiting for my answer, plus my loans past their return date. */
export async function countNeedingAttention(memberId: string) {
  const [row] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from agreement
     where (other_member_id = ${memberId} and confirmation = 'pending')
        or ((owner_id = ${memberId} or other_member_id = ${memberId}) and outcome = 'lent'
            and returned_at is null and confirmation <> 'cancelled' and return_due < current_date)`);
  return row?.count ?? 0;
}

/** Only the two parties (and, with problem reports, their mediators) can see an agreement. */
async function viewableAgreement(agreementId: string, memberId: string) {
  const [row] = await db.select().from(agreement).where(eq(agreement.id, agreementId));
  if (!row) throw errors.notFound('That agreement');
  if (row.ownerId === memberId || row.otherMemberId === memberId) return row;
  if (await isMediator(agreementId, memberId)) return row;
  throw errors.notFound('That agreement');
}

async function partyAgreement(agreementId: string, memberId: string) {
  const [row] = await db.select().from(agreement).where(eq(agreement.id, agreementId));
  if (!row || (row.ownerId !== memberId && row.otherMemberId !== memberId)) throw errors.notFound('That agreement');
  return row;
}

// Mediators are added with problem reports (US6); until then, nobody else can see agreements.
let isMediator: (agreementId: string, memberId: string) => Promise<boolean> = async () => false;
export function setMediatorCheck(check: typeof isMediator) {
  isMediator = check;
}

async function describe(rows: AgreementRow[], memberId: string) {
  if (rows.length === 0) return [];
  const listings = await db.select().from(listing).where(inArray(listing.id, [...new Set(rows.map((r) => r.listingId))]));
  const people = await db.select().from(member).where(inArray(member.id, [...new Set(rows.flatMap((r) => [r.ownerId, r.otherMemberId]))]));
  const listingById = new Map(listings.map((l) => [l.id, l]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const today = new Date().toISOString().slice(0, 10);

  return rows.map((row) => {
    const item = listingById.get(row.listingId)!;
    const owner = personById.get(row.ownerId)!;
    const other = personById.get(row.otherMemberId)!;
    const myRole = row.ownerId === memberId ? 'owner' : row.otherMemberId === memberId ? 'other' : 'mediator';
    return {
      id: row.id,
      listing: { id: item.id, title: item.title, type: item.type, unit: item.unit },
      owner: { id: owner.id, displayName: shownName(owner) },
      otherMember: { id: other.id, displayName: shownName(other) },
      outcome: row.outcome,
      amount: trimDecimal(row.amount),
      sessions: row.sessions,
      returnDue: row.returnDue,
      returnedAt: row.returnedAt?.toISOString() ?? null,
      confirmation: row.confirmation,
      note: row.note,
      createdAt: row.createdAt.toISOString(),
      myRole,
      group: myRole === 'mediator' ? null : groupFor(row.outcome, myRole === 'owner'),
      overdue: row.outcome === 'lent' && !row.returnedAt && row.confirmation !== 'cancelled' && row.returnDue !== null && row.returnDue < today
    } as const;
  });
}

function groupFor(outcome: AgreementRow['outcome'], isOwner: boolean) {
  if (outcome === 'lent') return isOwner ? 'lent' : 'borrowed';
  if (outcome === 'provided') return isOwner ? 'provided' : 'received';
  return isOwner ? 'given' : 'received';
}

// Used by reminders: loans past their return date, not returned, never reminded.
export const overdueLoansCondition = () =>
  and(eq(agreement.outcome, 'lent'), isNull(agreement.returnedAt), isNull(agreement.reminderSentAt), ne(agreement.confirmation, 'cancelled'), lt(agreement.returnDue, sql`current_date`));
