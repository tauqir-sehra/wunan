// Listings: create, read, edit, pause/resume/remove/reopen, my listings, and flags
// (001 FR-007 to FR-014, FR-013a, FR-013b; 002 FR-001 to FR-009, FR-011a, FR-019a, FR-029).
// Only the owner can change a listing. Flags never hide or change it. "Lent out" is not stored:
// a lend listing is lent out while one of its loans has started and isn't marked returned.
import { CreateListing } from '@wunan/shared';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { agreement, listing, listingFlag, listingPhoto, member, proposal, serviceAvailability, tradeAccept } from '../db/schema/index.ts';
import { ApiError, errors, validationError } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { notify } from '../notify/index.ts';
import { shownName } from './members.ts';
import { viewPlace } from './places.ts';

type ListingRow = typeof listing.$inferSelect;
type Values = typeof listing.$inferInsert;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Turns validated input into table values; every field not used by the type is null. */
function toValues(input: CreateListing): Omit<Values, 'ownerId'> {
  const base = {
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    area: input.area ?? null,
    meetingPlace: input.meetingPlace ?? null,
    handovers: input.handovers ?? [],
    amount: null as string | null,
    unit: null as Values['unit'],
    loanLength: null as number | null,
    loanLengthUnit: null as Values['loanLengthUnit'],
    sessionLength: null as number | null,
    sessionLengthUnit: null as Values['sessionLengthUnit'],
    sessionsAvailable: null as number | null
  };
  switch (input.type) {
    case 'lend':
      return { ...base, amount: input.amount ?? null, unit: input.unit ?? null, loanLength: input.loanLength ?? null, loanLengthUnit: input.loanLengthUnit ?? null };
    case 'gift':
      return { ...base, amount: input.amount ?? null, unit: input.unit ?? null };
    case 'trade':
      return { ...base, amount: input.amount ?? null, unit: input.unit ?? null };
    case 'service':
      return {
        ...base,
        sessionLength: input.sessionLength ?? null,
        sessionLengthUnit: input.sessionLengthUnit ?? null,
        sessionsAvailable: input.sessionsAvailable ?? null
      };
  }
}

/** Saves a Trade's accepted things and a Service's times, replacing what was there. */
async function saveRows(tx: Transaction, listingId: string, input: CreateListing) {
  await tx.delete(tradeAccept).where(eq(tradeAccept.listingId, listingId));
  await tx.delete(serviceAvailability).where(eq(serviceAvailability.listingId, listingId));
  if (input.type === 'trade' && input.accepts?.length) {
    await tx.insert(tradeAccept).values(
      input.accepts.map((item, position) => ({ listingId, position, description: item.description, amount: item.amount ?? null, unit: item.unit ?? null }))
    );
  }
  if (input.type === 'service' && input.availability?.length) {
    await tx.insert(serviceAvailability).values(input.availability.map((row) => ({ listingId, ...row })));
  }
  await refreshSearchVector(tx, listingId);
}

/** Search words: the title counts most, then the description and what a trade accepts. */
async function refreshSearchVector(tx: Transaction, listingId: string) {
  await tx.execute(sql`
    update listing set search_vector =
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(
        (select string_agg(description, ' ') from trade_accept where listing_id = ${listingId}), '')), 'B')
    where id = ${listingId}`);
}

export async function createListing(ownerId: string, input: CreateListing) {
  const values = toValues(input);
  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(listing)
      .values({
        ...values,
        ownerId,
        // What's left starts at the full amount (Gift/Trade) or number of sessions (Service).
        remaining: values.type === 'gift' || values.type === 'trade' ? values.amount : null,
        sessionsRemaining: values.sessionsAvailable
      })
      .returning({ id: listing.id });
    await saveRows(tx, created!.id, input);
    return created!.id;
  });
  return getListing(id, ownerId);
}

/** Full listing with photos, owner, and owner's inviter. The owner also sees flags (marked seen). */
export async function getListing(listingId: string, viewerId: string) {
  const [row] = await db.select().from(listing).where(eq(listing.id, listingId));
  if (!row) throw errors.notFound('That listing');
  const [result] = await describe([row], viewerId);
  if (row.ownerId !== viewerId) return result!;
  const [open] = await db
    .select({ n: count() })
    .from(proposal)
    .where(and(eq(proposal.listingId, listingId), eq(proposal.status, 'open')));

  const flags = await db
    .select({ flag: listingFlag, from: { id: member.id, displayName: member.displayName, deletedAt: member.deletedAt } })
    .from(listingFlag)
    .innerJoin(member, eq(member.id, listingFlag.flaggedById))
    .where(eq(listingFlag.listingId, listingId))
    .orderBy(desc(listingFlag.createdAt));
  await db
    .update(listingFlag)
    .set({ seenByOwnerAt: new Date() })
    .where(and(eq(listingFlag.listingId, listingId), isNull(listingFlag.seenByOwnerAt)));
  return {
    ...result!,
    openProposalCount: open?.n ?? 0,
    flags: flags.map(({ flag, from }) => ({
      id: flag.id,
      request: flag.request,
      from: { id: from.id, displayName: shownName(from) },
      createdAt: flag.createdAt.toISOString(),
      seen: flag.seenByOwnerAt !== null
    }))
  };
}

export async function updateListing(listingId: string, ownerId: string, changes: Record<string, unknown>) {
  const current = await ownedListing(listingId, ownerId);
  // Merge and re-check the whole listing, so the per-type rules always hold.
  const merged = { ...(await editableFields(current)), ...changes, type: current.type };
  const parsed = CreateListing.safeParse(merged);
  if (!parsed.success) throw validationError(parsed.error);
  const values = toValues(parsed.data);

  await db.transaction(async (tx) => {
    await tx
      .update(listing)
      .set({
        ...values,
        // Changing the amount moves what's left by the same difference (never below 0).
        remaining: adjust(current.remaining, current.amount, values.amount ?? null, current.type === 'gift' || current.type === 'trade'),
        sessionsRemaining: adjustWhole(current.sessionsRemaining, current.sessionsAvailable, values.sessionsAvailable ?? null),
        updatedAt: new Date()
      })
      .where(eq(listing.id, listingId));
    // Accepted things and times are replaced only when the edit includes them.
    if ('accepts' in changes || 'availability' in changes || 'title' in changes || 'description' in changes) {
      await saveRows(tx, listingId, parsed.data);
    }
  });
  return getListing(listingId, ownerId);
}

type StatusChange = 'pause' | 'resume' | 'remove' | 'reopen';

/** Owner status changes, following data-model.md "States". */
export async function changeStatus(listingId: string, ownerId: string, change: StatusChange) {
  const current = await ownedListing(listingId, ownerId);
  const notNow = (message: string) => new ApiError(409, 'not_possible_now', message);
  let next: Pick<Values, 'status' | 'closedReason'>;
  switch (change) {
    case 'pause':
      if (current.status !== 'available') throw notNow('Only an available listing can be paused.');
      next = { status: 'paused', closedReason: null };
      break;
    case 'resume':
      if (current.status !== 'paused') throw notNow('Only a paused listing can be made available again.');
      next = { status: 'available', closedReason: null };
      break;
    case 'remove':
      if (current.status === 'closed') throw notNow('This listing is already closed.');
      next = { status: 'closed', closedReason: 'removed' };
      break;
    case 'reopen':
      if (current.status !== 'closed' || current.closedReason !== 'removed') {
        throw notNow('Only a listing you removed can be reopened. When nothing is left, please create a new listing.');
      }
      // The remaining amount is kept as it was (FR-013b).
      next = { status: 'available', closedReason: null };
      break;
  }
  await db.update(listing).set({ ...next, updatedAt: new Date() }).where(eq(listing.id, listingId));
  return getListing(listingId, ownerId);
}

export async function listMine(ownerId: string) {
  const rows = await db.select().from(listing).where(eq(listing.ownerId, ownerId)).orderBy(desc(listing.createdAt));
  const described = await describe(rows, ownerId);
  const unseen = rows.length
    ? await db
        .select({ listingId: listingFlag.listingId, unseen: count() })
        .from(listingFlag)
        .where(and(inArray(listingFlag.listingId, rows.map((r) => r.id)), isNull(listingFlag.seenByOwnerAt)))
        .groupBy(listingFlag.listingId)
    : [];
  const unseenBy = new Map(unseen.map((u) => [u.listingId, u.unseen]));
  return described.map((item) => ({ ...item, unseenFlags: unseenBy.get(item.id) ?? 0 }));
}

/** Another member's written request to the owner (FR-013a). The listing itself is unchanged. */
export async function flagListing(listingId: string, memberId: string, request: string) {
  const [row] = await db.select().from(listing).where(eq(listing.id, listingId));
  if (!row) throw errors.notFound('That listing');
  if (row.ownerId === memberId) {
    throw new ApiError(400, 'own_listing', "This is your own listing. You can edit it instead.");
  }
  await checkRateLimit(`flag:${memberId}`, 10, 24 * 60);
  await db.insert(listingFlag).values({ listingId, flaggedById: memberId, request });
  const [sender] = await db.select().from(member).where(eq(member.id, memberId));
  await notify(row.ownerId, 'flag', {
    title: `${sender?.displayName ?? 'A member'} sent a request about your listing`,
    body: request,
    url: `/listings/${listingId}`
  });
}

/** Loads a listing the member owns, or explains why they can't change it. */
export async function ownedListing(listingId: string, ownerId: string): Promise<ListingRow> {
  const [row] = await db.select().from(listing).where(eq(listing.id, listingId));
  if (!row) throw errors.notFound('That listing');
  if (row.ownerId !== ownerId) throw new ApiError(403, 'not_owner', 'Only the person who listed this can change it.');
  return row;
}

/** Loans of these listings not yet marked returned, oldest first (002 FR-011a). */
export async function unreturnedLoans(listingIds: string[]) {
  if (listingIds.length === 0) return [];
  return db
    .select({ id: agreement.id, listingId: agreement.listingId, startsAt: agreement.loanStartsAt, endsAt: agreement.loanEndsAt })
    .from(agreement)
    .where(and(inArray(agreement.listingId, listingIds), isNotNull(agreement.loanStartsAt), isNull(agreement.returnedAt)))
    .orderBy(asc(agreement.loanStartsAt));
}

/** SQL condition: a lend listing is lent out now (a loan has started and isn't marked returned). */
export const lentOutNow = sql<boolean>`exists (select 1 from agreement a where a.listing_id = ${listing.id}
  and a.loan_starts_at <= now() and a.returned_at is null)`;

/**
 * Adds photos, owner, inviter, accepted things, times, loans, and the viewer's own proposal to
 * listing rows (for API responses). Places are shown in full only to the owner and to members whose
 * proposal on the listing was accepted (002 FR-029).
 */
export async function describe(rows: ListingRow[], viewerId: string) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const now = new Date();
  const [photos, accepts, times, loans, mine] = await Promise.all([
    db.select().from(listingPhoto).where(inArray(listingPhoto.listingId, ids)).orderBy(asc(listingPhoto.position), asc(listingPhoto.createdAt)),
    db.select().from(tradeAccept).where(inArray(tradeAccept.listingId, ids)).orderBy(asc(tradeAccept.position)),
    db
      .select()
      .from(serviceAvailability)
      .where(inArray(serviceAvailability.listingId, ids))
      .orderBy(asc(serviceAvailability.weekday), asc(serviceAvailability.startTime)),
    unreturnedLoans(ids),
    db
      .select({ id: proposal.id, listingId: proposal.listingId, status: proposal.status })
      .from(proposal)
      .where(and(inArray(proposal.listingId, ids), eq(proposal.requesterId, viewerId), inArray(proposal.status, ['open', 'accepted'])))
  ]);
  const owners = await db.select().from(member).where(inArray(member.id, [...new Set(rows.map((r) => r.ownerId))]));
  const inviterIds = owners.map((o) => o.invitedById).filter((id): id is string => Boolean(id));
  const inviters = inviterIds.length ? await db.select().from(member).where(inArray(member.id, inviterIds)) : [];
  const byId = new Map([...owners, ...inviters].map((m) => [m.id, m]));

  return rows.map((row) => {
    const owner = byId.get(row.ownerId)!;
    const inviter = owner.invitedById ? byId.get(owner.invitedById) : undefined;
    const fullPlaces = row.ownerId === viewerId || mine.some((p) => p.listingId === row.id && p.status === 'accepted');
    const myLoans = loans.filter((loan) => loan.listingId === row.id);
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description,
      amount: trimDecimal(row.amount),
      unit: row.unit,
      remaining: trimDecimal(row.remaining),
      loanLength: row.loanLength,
      loanLengthUnit: row.loanLengthUnit,
      accepts: accepts
        .filter((a) => a.listingId === row.id)
        .map((a) => ({ id: a.id, description: a.description, amount: trimDecimal(a.amount), unit: a.unit })),
      sessionLength: row.sessionLength,
      sessionLengthUnit: row.sessionLengthUnit,
      sessionsAvailable: row.sessionsAvailable,
      sessionsRemaining: row.sessionsRemaining,
      availability: times
        .filter((t) => t.listingId === row.id)
        .map((t) => ({ weekday: t.weekday, startTime: t.startTime.slice(0, 5), endTime: t.endTime.slice(0, 5) })),
      handovers: row.handovers,
      area: viewPlace(row.area, { full: fullPlaces }),
      meetingPlace: viewPlace(row.meetingPlace, { full: fullPlaces }),
      status: row.status,
      lentOut: myLoans.some((loan) => loan.startsAt! <= now),
      takenPeriods: myLoans.map((loan) => ({
        startsAt: loan.startsAt!.toISOString(),
        endsAt: loan.endsAt!.toISOString(),
        overdue: loan.endsAt! <= now
      })),
      myOpenProposalId: mine.find((p) => p.listingId === row.id && p.status === 'open')?.id ?? null,
      closedReason: row.closedReason,
      createdAt: row.createdAt.toISOString(),
      owner: {
        id: owner.id,
        displayName: shownName(owner),
        invitedBy: inviter ? { id: inviter.id, displayName: shownName(inviter) } : null
      },
      photos: photos
        .filter((p) => p.listingId === row.id)
        .map((p) => ({ id: p.id, key: p.fileKey, url: `/api/v1/photos/${p.fileKey}`, alt: p.altText, position: p.position }))
    };
  });
}

/** The saved fields in input form, used to merge edits. */
async function editableFields(row: ListingRow): Promise<Record<string, unknown>> {
  const accepts = await db.select().from(tradeAccept).where(eq(tradeAccept.listingId, row.id)).orderBy(asc(tradeAccept.position));
  const times = await db.select().from(serviceAvailability).where(eq(serviceAvailability.listingId, row.id));
  const all: Record<string, unknown> = {
    title: row.title,
    description: row.description,
    area: row.area,
    meetingPlace: row.meetingPlace,
    handovers: row.handovers,
    amount: trimDecimal(row.amount),
    unit: row.unit,
    loanLength: row.loanLength,
    loanLengthUnit: row.loanLengthUnit,
    accepts: accepts.map((a) => ({ description: a.description, amount: trimDecimal(a.amount), unit: a.unit })),
    sessionLength: row.sessionLength,
    sessionLengthUnit: row.sessionLengthUnit,
    sessionsAvailable: row.sessionsAvailable,
    availability: times.map((t) => ({ weekday: t.weekday, startTime: t.startTime.slice(0, 5), endTime: t.endTime.slice(0, 5) }))
  };
  const forType: Record<ListingRow['type'], string[]> = {
    lend: ['amount', 'unit', 'loanLength', 'loanLengthUnit'],
    gift: ['amount', 'unit'],
    trade: ['amount', 'unit', 'accepts'],
    service: ['sessionLength', 'sessionLengthUnit', 'sessionsAvailable', 'availability']
  };
  const keep = new Set(['title', 'description', 'area', 'meetingPlace', 'handovers', ...forType[row.type]]);
  return Object.fromEntries(Object.entries(all).filter(([key]) => keep.has(key)));
}

/** "5.000" → "5", "2.500" → "2.5". */
export function trimDecimal(value: string | null): string | null {
  if (value === null) return null;
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

function adjust(remaining: string | null, oldTotal: string | null, newTotal: string | null, applies: boolean) {
  if (!applies || newTotal === null) return null;
  if (remaining === null || oldTotal === null) return newTotal;
  return String(Math.max(0, Number(remaining) + Number(newTotal) - Number(oldTotal)));
}

function adjustWhole(remaining: number | null, oldTotal: number | null, newTotal: number | null) {
  if (newTotal === null) return null;
  if (remaining === null || oldTotal === null) return newTotal;
  return Math.max(0, remaining + newTotal - oldTotal);
}
