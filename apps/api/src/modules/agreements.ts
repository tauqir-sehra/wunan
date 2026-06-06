// Agreements (001 FR-025, FR-026; 002 FR-018 to FR-021): made by modules/proposals.ts when a lister
// accepts a proposal, and confirmed from the start. Here: history, one agreement, marking a loan
// returned, and the loans that need a reminder.
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { agreement, offering, member } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { communityTimeZone } from '../lib/time.ts';
import { earlierLoanNotBack, trimDecimal } from './offerings.ts';
import { shownName } from './members.ts';
import { viewPlace } from './places.ts';

type AgreementRow = typeof agreement.$inferSelect;

export const outcomeFor = { lend: 'lent', gift: 'gifted', trade: 'traded', service: 'provided' } as const;

/** The owner marks a loan returned; the rest of its period is free again (001 FR-025). */
export async function markReturned(agreementId: string, ownerId: string) {
  const row = await partyAgreement(agreementId, ownerId);
  if (row.ownerId !== ownerId) throw new ApiError(403, 'not_allowed', 'Only the owner can mark this returned.');
  if (row.outcome !== 'lent') throw new ApiError(400, 'not_a_loan', 'Only loans can be marked returned.');
  if (row.returnedAt) throw new ApiError(409, 'already_returned', 'This loan is already finished.');
  await db.update(agreement).set({ returnedAt: new Date() }).where(eq(agreement.id, agreementId));
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
  const stillOut = row.outcome === 'lent' && !row.returnedAt && row.loanStartsAt;
  return {
    ...(await describe([row], memberId))[0]!,
    earlierLoanNotBack: stillOut ? await earlierLoanNotBack(row.offeringId, row.loanStartsAt!, row.id) : null,
    reports: await reportsFor(agreementId)
  };
}

// Requests for help on an agreement are listed with it (set by modules/reports.ts).
let reportsFor: (agreementId: string) => Promise<{ id: string; status: 'open' | 'resolved'; outcomeNote: string | null }[]> = async () => [];
export function setReportsLookup(lookup: typeof reportsFor) {
  reportsFor = lookup;
}

/** Count for home: my loans (lent or borrowed) past their end and not yet marked returned. */
export async function countNeedingAttention(memberId: string) {
  const [row] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count from agreement
     where (owner_id = ${memberId} or other_member_id = ${memberId}) and outcome = 'lent'
       and returned_at is null and loan_ends_at < now()`);
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
  const offerings = await db.select().from(offering).where(inArray(offering.id, [...new Set(rows.map((r) => r.offeringId))]));
  const people = await db.select().from(member).where(inArray(member.id, [...new Set(rows.flatMap((r) => [r.ownerId, r.otherMemberId]))]));
  const offeringById = new Map(offerings.map((l) => [l.id, l]));
  const personById = new Map(people.map((p) => [p.id, p]));
  const now = new Date();

  return rows.map((row) => {
    const item = offeringById.get(row.offeringId)!;
    const owner = personById.get(row.ownerId)!;
    const other = personById.get(row.otherMemberId)!;
    const myRole = row.ownerId === memberId ? 'owner' : row.otherMemberId === memberId ? 'other' : 'mediator';
    return {
      id: row.id,
      proposalId: row.proposalId,
      offering: { id: item.id, title: item.title, type: item.type, unit: item.unit },
      owner: { id: owner.id, displayName: shownName(owner) },
      otherMember: { id: other.id, displayName: shownName(other) },
      outcome: row.outcome,
      startsAt: row.startsAt?.toISOString() ?? null,
      hasTime: row.hasTime,
      handover: row.handover,
      // Only the two members and mediators get here, and they all may see the place in full.
      place: viewPlace(row.place, { full: true }),
      amount: trimDecimal(row.amount),
      sessions: row.sessions,
      sessionLength: row.sessionLength,
      sessionLengthUnit: row.sessionLengthUnit,
      loanStartsAt: row.loanStartsAt?.toISOString() ?? null,
      loanEndsAt: row.loanEndsAt?.toISOString() ?? null,
      offer: row.offer,
      returnedAt: row.returnedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      myRole,
      group: myRole === 'mediator' ? null : groupFor(row.outcome, myRole === 'owner'),
      overdue: row.outcome === 'lent' && !row.returnedAt && row.loanEndsAt !== null && row.loanEndsAt <= now
    } as const;
  });
}

function groupFor(outcome: AgreementRow['outcome'], isOwner: boolean) {
  if (outcome === 'lent') return isOwner ? 'lent' : 'borrowed';
  if (outcome === 'provided') return isOwner ? 'provided' : 'received';
  return isOwner ? 'given' : 'received';
}

/**
 * Used by reminders: loans not returned and never reminded, whose end date (in the community's time
 * zone) is before today, i.e. it's at least the day after they were due back (001 FR-025).
 */
export const overdueLoansCondition = () => {
  const zone = communityTimeZone();
  return and(
    eq(agreement.outcome, 'lent'),
    isNull(agreement.returnedAt),
    isNull(agreement.reminderSentAt),
    isNotNull(agreement.loanEndsAt),
    sql`(${agreement.loanEndsAt} at time zone ${zone})::date < (now() at time zone ${zone})::date`
  );
};
