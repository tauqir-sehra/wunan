// Listings: create, read, edit, pause/resume/remove/reopen, my listings, and flags
// (FR-007 to FR-014, FR-013a, FR-013b; data-model.md "listing" states).
// Only the owner can change a listing. Flags never hide or change it.
import { CreateListing } from '@wunan/shared';
import { and, asc, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { listing, listingFlag, listingPhoto, member } from '../db/schema/index.ts';
import { ApiError, errors, validationError } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { notify } from '../notify/index.ts';
import { shownName } from './members.ts';

type ListingRow = typeof listing.$inferSelect;
type Values = typeof listing.$inferInsert;

/** Turns validated input into table values; every field not used by the type is null. */
function toValues(input: CreateListing): Omit<Values, 'ownerId'> {
  const base = {
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    area: input.area ?? null,
    amount: null as string | null,
    unit: null as Values['unit'],
    loanLength: null as number | null,
    loanLengthUnit: null as Values['loanLengthUnit'],
    wanted: null as string | null,
    wantedAmount: null as string | null,
    wantedUnit: null as Values['wantedUnit'],
    openToOffers: false,
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
      return {
        ...base,
        amount: input.amount ?? null,
        unit: input.unit ?? null,
        wanted: input.wanted ?? null,
        wantedAmount: input.wantedAmount ?? null,
        wantedUnit: input.wantedUnit ?? null,
        openToOffers: input.openToOffers ?? false
      };
    case 'service':
      return {
        ...base,
        sessionLength: input.sessionLength ?? null,
        sessionLengthUnit: input.sessionLengthUnit ?? null,
        sessionsAvailable: input.sessionsAvailable ?? null
      };
  }
}

export async function createListing(ownerId: string, input: CreateListing) {
  const values = toValues(input);
  const [created] = await db
    .insert(listing)
    .values({
      ...values,
      ownerId,
      // What's left starts at the full amount (Gift/Trade) or number of sessions (Service).
      remaining: values.type === 'gift' || values.type === 'trade' ? values.amount : null,
      sessionsRemaining: values.sessionsAvailable
    })
    .returning();
  return getListing(created!.id, ownerId);
}

/** Full listing with photos, owner, and owner's inviter. The owner also sees flags (marked seen). */
export async function getListing(listingId: string, viewerId: string) {
  const [row] = await db.select().from(listing).where(eq(listing.id, listingId));
  if (!row) throw errors.notFound('That listing');
  const [result] = await describe([row]);
  if (row.ownerId !== viewerId) return result!;

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
  const merged = { ...editableFields(current), ...changes, type: current.type };
  const parsed = CreateListing.safeParse(merged);
  if (!parsed.success) throw validationError(parsed.error);
  const values = toValues(parsed.data);

  await db
    .update(listing)
    .set({
      ...values,
      // Changing the amount moves what's left by the same difference (never below 0).
      remaining: adjust(current.remaining, current.amount, values.amount ?? null, current.type === 'gift' || current.type === 'trade'),
      sessionsRemaining: adjustWhole(current.sessionsRemaining, current.sessionsAvailable, values.sessionsAvailable ?? null),
      updatedAt: new Date()
    })
    .where(eq(listing.id, listingId));
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
  const described = await describe(rows);
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

/** Adds photos, owner, and the owner's inviter to listing rows (for API responses). */
export async function describe(rows: ListingRow[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const photos = await db.select().from(listingPhoto).where(inArray(listingPhoto.listingId, ids)).orderBy(asc(listingPhoto.position), asc(listingPhoto.createdAt));
  const owners = await db.select().from(member).where(inArray(member.id, [...new Set(rows.map((r) => r.ownerId))]));
  const inviterIds = owners.map((o) => o.invitedById).filter((id): id is string => Boolean(id));
  const inviters = inviterIds.length ? await db.select().from(member).where(inArray(member.id, inviterIds)) : [];
  const byId = new Map([...owners, ...inviters].map((m) => [m.id, m]));

  return rows.map((row) => {
    const owner = byId.get(row.ownerId)!;
    const inviter = owner.invitedById ? byId.get(owner.invitedById) : undefined;
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
      wanted: row.wanted,
      wantedAmount: trimDecimal(row.wantedAmount),
      wantedUnit: row.wantedUnit,
      openToOffers: row.openToOffers,
      sessionLength: row.sessionLength,
      sessionLengthUnit: row.sessionLengthUnit,
      sessionsAvailable: row.sessionsAvailable,
      sessionsRemaining: row.sessionsRemaining,
      area: row.area,
      status: row.status,
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
function editableFields(row: ListingRow): Record<string, unknown> {
  const all: Record<string, unknown> = {
    title: row.title,
    description: row.description,
    area: row.area,
    amount: trimDecimal(row.amount),
    unit: row.unit,
    loanLength: row.loanLength,
    loanLengthUnit: row.loanLengthUnit,
    wanted: row.wanted,
    wantedAmount: trimDecimal(row.wantedAmount),
    wantedUnit: row.wantedUnit,
    openToOffers: row.openToOffers,
    sessionLength: row.sessionLength,
    sessionLengthUnit: row.sessionLengthUnit,
    sessionsAvailable: row.sessionsAvailable
  };
  const forType: Record<ListingRow['type'], string[]> = {
    lend: ['amount', 'unit', 'loanLength', 'loanLengthUnit'],
    gift: ['amount', 'unit'],
    trade: ['amount', 'unit', 'wanted', 'wantedAmount', 'wantedUnit', 'openToOffers'],
    service: ['sessionLength', 'sessionLengthUnit', 'sessionsAvailable']
  };
  const keep = new Set(['title', 'description', 'area', ...forType[row.type]]);
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
