// Offerings: create, read, edit, pause/resume/remove/reopen, my offerings, and flags
// (001 FR-007 to FR-014, FR-013a, FR-013b; 002 FR-001 to FR-009, FR-011a, FR-019a, FR-029).
// Only the owner can change an offering. Flags never hide or change it. "Lent out" is not stored:
// a lend offering is lent out while one of its loans has started and isn't marked returned.
import { CreateOffering } from '@wunan/shared';
import { and, asc, count, desc, eq, inArray, isNotNull, isNull, lt, lte, ne, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { arrangement, flag, offering, offeringPhoto, member, request, requestLink, serviceAvailability, tradeAccept } from '../db/schema/index.ts';
import { requestKindFor } from '@wunan/shared';
import { ApiError, errors, validationError } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { notify } from '../notify/index.ts';
import { shownName } from './members.ts';
import { viewPlace } from './places.ts';

type OfferingRow = typeof offering.$inferSelect;
type Values = typeof offering.$inferInsert;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Turns validated input into table values; every field not used by the type is null. */
function toValues(input: CreateOffering): Omit<Values, 'ownerId'> {
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
async function saveRows(tx: Transaction, offeringId: string, input: CreateOffering) {
  await tx.delete(tradeAccept).where(eq(tradeAccept.offeringId, offeringId));
  await tx.delete(serviceAvailability).where(eq(serviceAvailability.offeringId, offeringId));
  if (input.type === 'trade' && input.accepts?.length) {
    await tx.insert(tradeAccept).values(
      input.accepts.map((item, position) => ({ offeringId, position, description: item.description, amount: item.amount ?? null, unit: item.unit ?? null }))
    );
  }
  if (input.type === 'service' && input.availability?.length) {
    await tx.insert(serviceAvailability).values(input.availability.map((row) => ({ offeringId, ...row })));
  }
  await refreshSearchVector(tx, offeringId);
}

/** Search words: the title counts most, then the description and what a trade accepts. */
async function refreshSearchVector(tx: Transaction, offeringId: string) {
  await tx.execute(sql`
    update offering set search_vector =
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(
        (select string_agg(description, ' ') from trade_accept where offering_id = ${offeringId}), '')), 'B')
    where id = ${offeringId}`);
}

export async function createOffering(ownerId: string, input: CreateOffering) {
  const values = toValues(input);
  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(offering)
      .values({
        ...values,
        ownerId,
        // What's left starts at the full amount (Gift/Trade) or number of sessions (Service).
        remaining: values.type === 'gift' || values.type === 'trade' ? values.amount : null,
        sessionsRemaining: values.sessionsAvailable
      })
      .returning({ id: offering.id });
    await saveRows(tx, created!.id, input);
    return created!.id;
  });
  return getOffering(id, ownerId);
}

/** Full offering with photos, owner, and owner's inviter. The owner also sees flags (marked seen). */
export async function getOffering(offeringId: string, viewerId: string) {
  const [row] = await db.select().from(offering).where(eq(offering.id, offeringId));
  if (!row) throw errors.notFound('That offering');
  const [described] = await describe([row], viewerId);
  const result = { ...described!, ...(await requestsAround(row, viewerId)) };
  if (row.ownerId !== viewerId) return result;
  const [open] = await db
    .select({ n: count() })
    .from(arrangement)
    .where(and(eq(arrangement.offeringId, offeringId), eq(arrangement.status, 'open')));

  const flags = await db
    .select({ flag: flag, from: { id: member.id, displayName: member.displayName, deletedAt: member.deletedAt } })
    .from(flag)
    .innerJoin(member, eq(member.id, flag.flaggedById))
    .where(eq(flag.offeringId, offeringId))
    .orderBy(desc(flag.createdAt));
  await db
    .update(flag)
    .set({ seenAt: new Date() })
    .where(and(eq(flag.offeringId, offeringId), isNull(flag.seenAt)));
  return {
    ...result,
    openArrangementCount: open?.n ?? 0,
    flags: flags.map(({ flag, from }) => ({
      id: flag.id,
      request: flag.request,
      from: { id: from.id, displayName: shownName(from) },
      createdAt: flag.createdAt.toISOString(),
      seen: flag.seenAt !== null
    }))
  };
}

export async function updateOffering(offeringId: string, ownerId: string, changes: Record<string, unknown>) {
  const current = await ownedOffering(offeringId, ownerId);
  // Merge and re-check the whole offering, so the per-type rules always hold.
  const merged = { ...(await editableFields(current)), ...changes, type: current.type };
  const parsed = CreateOffering.safeParse(merged);
  if (!parsed.success) throw validationError(parsed.error);
  const values = toValues(parsed.data);

  await db.transaction(async (tx) => {
    await tx
      .update(offering)
      .set({
        ...values,
        // Changing the amount moves what's left by the same difference (never below 0).
        remaining: adjust(current.remaining, current.amount, values.amount ?? null, current.type === 'gift' || current.type === 'trade'),
        sessionsRemaining: adjustWhole(current.sessionsRemaining, current.sessionsAvailable, values.sessionsAvailable ?? null),
        updatedAt: new Date()
      })
      .where(eq(offering.id, offeringId));
    // Accepted things and times are replaced only when the edit includes them.
    if ('accepts' in changes || 'availability' in changes || 'title' in changes || 'description' in changes) {
      await saveRows(tx, offeringId, parsed.data);
    }
  });
  return getOffering(offeringId, ownerId);
}

type StatusChange = 'pause' | 'resume' | 'remove' | 'reopen';

/** Owner status changes, following data-model.md "States". */
export async function changeStatus(offeringId: string, ownerId: string, change: StatusChange) {
  const current = await ownedOffering(offeringId, ownerId);
  const notNow = (message: string) => new ApiError(409, 'not_possible_now', message);
  let next: Pick<Values, 'status' | 'closedReason'>;
  switch (change) {
    case 'pause':
      if (current.status !== 'available') throw notNow('Only an available offering can be paused.');
      next = { status: 'paused', closedReason: null };
      break;
    case 'resume':
      if (current.status !== 'paused') throw notNow('Only a paused offering can be made available again.');
      next = { status: 'available', closedReason: null };
      break;
    case 'remove':
      if (current.status === 'closed') throw notNow('This offering is already closed.');
      next = { status: 'closed', closedReason: 'removed' };
      break;
    case 'reopen':
      if (current.status !== 'closed' || current.closedReason !== 'removed') {
        throw notNow('Only an offering you removed can be reopened. When nothing is left, please create a new offering.');
      }
      // The remaining amount is kept as it was (FR-013b).
      next = { status: 'available', closedReason: null };
      break;
  }
  await db.update(offering).set({ ...next, updatedAt: new Date() }).where(eq(offering.id, offeringId));
  return getOffering(offeringId, ownerId);
}

export async function listMine(ownerId: string) {
  const rows = await db.select().from(offering).where(eq(offering.ownerId, ownerId)).orderBy(desc(offering.createdAt));
  const described = await describe(rows, ownerId);
  const unseen = rows.length
    ? await db
        .select({ offeringId: flag.offeringId, unseen: count() })
        .from(flag)
        .where(and(inArray(flag.offeringId, rows.map((r) => r.id)), isNull(flag.seenAt)))
        .groupBy(flag.offeringId)
    : [];
  const unseenBy = new Map(unseen.map((u) => [u.offeringId, u.unseen]));
  return described.map((item) => ({ ...item, unseenFlags: unseenBy.get(item.id) ?? 0 }));
}

/** Another member's written request to the owner (FR-013a). The offering itself is unchanged. */
export async function flagOffering(offeringId: string, memberId: string, request: string) {
  const [row] = await db.select().from(offering).where(eq(offering.id, offeringId));
  if (!row) throw errors.notFound('That offering');
  if (row.ownerId === memberId) {
    throw new ApiError(400, 'own_offering', "This is your own offering. You can edit it instead.");
  }
  await checkRateLimit(`flag:${memberId}`, 10, 24 * 60);
  await db.insert(flag).values({ offeringId, flaggedById: memberId, request });
  const [sender] = await db.select().from(member).where(eq(member.id, memberId));
  await notify(row.ownerId, 'flag', {
    title: `${sender?.displayName ?? 'A member'} sent a request about your offering`,
    body: request,
    url: `/offerings/${offeringId}`
  });
}

/** Loads an offering the member owns, or explains why they can't change it. */
export async function ownedOffering(offeringId: string, ownerId: string): Promise<OfferingRow> {
  const [row] = await db.select().from(offering).where(eq(offering.id, offeringId));
  if (!row) throw errors.notFound('That offering');
  if (row.ownerId !== ownerId) throw new ApiError(403, 'not_owner', 'Only the person who listed this can change it.');
  return row;
}

/** Loans of these offerings not yet marked returned, oldest first (002 FR-011a). */
export async function unreturnedLoans(offeringIds: string[]) {
  if (offeringIds.length === 0) return [];
  return db
    .select({ id: arrangement.id, offeringId: arrangement.offeringId, startsAt: arrangement.loanStartsAt, endsAt: arrangement.loanEndsAt })
    .from(arrangement)
    .where(and(inArray(arrangement.offeringId, offeringIds), isNotNull(arrangement.loanStartsAt), isNull(arrangement.returnedAt)))
    .orderBy(asc(arrangement.loanStartsAt));
}

/**
 * An earlier loan of this offering that should be back by now but isn't marked returned, starting
 * before `startsAt` (002 Edge Case "Earlier loan not back in time"). Shown calmly on the next loan.
 */
export async function earlierLoanNotBack(offeringId: string, startsAt: Date, exceptArrangementId?: string | null) {
  const [row] = await db
    .select({ endsAt: arrangement.loanEndsAt })
    .from(arrangement)
    .where(
      and(
        eq(arrangement.offeringId, offeringId),
        isNull(arrangement.returnedAt),
        lt(arrangement.loanStartsAt, startsAt),
        lte(arrangement.loanEndsAt, new Date()),
        exceptArrangementId ? ne(arrangement.id, exceptArrangementId) : undefined
      )
    )
    .orderBy(asc(arrangement.loanEndsAt))
    .limit(1);
  return row?.endsAt ? { endsAt: row.endsAt.toISOString() } : null;
}

/** SQL condition: a lend offering is lent out now (a loan has started and isn't marked returned). */
export const lentOutNow = sql<boolean>`exists (select 1 from arrangement a where a.offering_id = ${offering.id}
  and a.loan_starts_at <= now() and a.returned_at is null)`;

/**
 * Adds photos, owner, inviter, accepted things, times, loans, and the viewer's own arrangement to
 * offering rows (for API responses). Places are shown in full only to the owner and to members with
 * an agreed arrangement on the offering (002 FR-029).
 */
export async function describe(rows: OfferingRow[], viewerId: string) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const now = new Date();
  const [photos, accepts, times, loans, mine, answers] = await Promise.all([
    db.select().from(offeringPhoto).where(inArray(offeringPhoto.offeringId, ids)).orderBy(asc(offeringPhoto.position), asc(offeringPhoto.createdAt)),
    db.select().from(tradeAccept).where(inArray(tradeAccept.offeringId, ids)).orderBy(asc(tradeAccept.position)),
    db
      .select()
      .from(serviceAvailability)
      .where(inArray(serviceAvailability.offeringId, ids))
      .orderBy(asc(serviceAvailability.weekday), asc(serviceAvailability.startTime)),
    unreturnedLoans(ids),
    db
      .select({ id: arrangement.id, offeringId: arrangement.offeringId, status: arrangement.status })
      .from(arrangement)
      .where(and(inArray(arrangement.offeringId, ids), eq(arrangement.requesterId, viewerId))),
    answersFor(ids)
  ]);
  const owners = await db.select().from(member).where(inArray(member.id, [...new Set(rows.map((r) => r.ownerId))]));
  const inviterIds = owners.map((o) => o.invitedById).filter((id): id is string => Boolean(id));
  const inviters = inviterIds.length ? await db.select().from(member).where(inArray(member.id, inviterIds)) : [];
  const byId = new Map([...owners, ...inviters].map((m) => [m.id, m]));

  return rows.map((row) => {
    const owner = byId.get(row.ownerId)!;
    const inviter = owner.invitedById ? byId.get(owner.invitedById) : undefined;
    const fullPlaces = row.ownerId === viewerId || mine.some((p) => p.offeringId === row.id && p.status === 'agreed');
    const myLoans = loans.filter((loan) => loan.offeringId === row.id);
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
        .filter((a) => a.offeringId === row.id)
        .map((a) => ({ id: a.id, description: a.description, amount: trimDecimal(a.amount), unit: a.unit })),
      sessionLength: row.sessionLength,
      sessionLengthUnit: row.sessionLengthUnit,
      sessionsAvailable: row.sessionsAvailable,
      sessionsRemaining: row.sessionsRemaining,
      availability: times
        .filter((t) => t.offeringId === row.id)
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
      // The one that isn't agreed (the database allows only one): open, or ended and can be asked again.
      myArrangement: myArrangementOn(mine, row.id),
      closedReason: row.closedReason,
      createdAt: row.createdAt.toISOString(),
      owner: {
        id: owner.id,
        displayName: shownName(owner),
        invitedBy: inviter ? { id: inviter.id, displayName: shownName(inviter) } : null
      },
      photos: photos
        .filter((p) => p.offeringId === row.id)
        .map((p) => ({ id: p.id, key: p.fileKey, url: `/api/v1/photos/${p.fileKey}`, alt: p.altText, position: p.position })),
      answersRequest: answers.find((a) => a.offeringId === row.id)?.view ?? null
    };
  });
}

/** Open requests these offerings are linked to, oldest link first (003 FR-014). */
async function answersFor(offeringIds: string[]) {
  const rows = await db
    .select({ offeringId: requestLink.offeringId, requestId: request.id, title: request.title, asker: { id: member.id, displayName: member.displayName, deletedAt: member.deletedAt } })
    .from(requestLink)
    .innerJoin(request, eq(request.id, requestLink.requestId))
    .innerJoin(member, eq(member.id, request.askerId))
    .where(and(inArray(requestLink.offeringId, offeringIds), eq(request.status, 'open')))
    .orderBy(asc(requestLink.createdAt));
  return rows.map((r) => ({ offeringId: r.offeringId, view: { requestId: r.requestId, title: r.title, asker: { id: r.asker.id, displayName: shownName(r.asker) } } }));
}

/**
 * What a single offering shows about requests: every open request it fulfils, the viewer's own open
 * requests it's linked to (for the ask form's prefill), and the viewer's open requests of the matching
 * kind it could still be linked to ("Link to my request", 003 FR-017a).
 */
async function requestsAround(row: OfferingRow, viewerId: string) {
  const answers = (await answersFor([row.id])).map((a) => a.view);
  const linkedIds = new Set(answers.map((a) => a.requestId));
  const mineLinked = answers.filter((a) => a.asker.id === viewerId).map((a) => ({ id: a.requestId, title: a.title }));
  const linkable =
    row.ownerId === viewerId || row.status !== 'available'
      ? []
      : (
          await db
            .select({ id: request.id, title: request.title })
            .from(request)
            .where(and(eq(request.askerId, viewerId), eq(request.status, 'open'), eq(request.kind, requestKindFor[row.type])))
            .orderBy(desc(request.createdAt))
        ).filter((r) => !linkedIds.has(r.id));
  return { answers, myOpenRequestsLinked: mineLinked, myLinkableRequests: linkable };
}

/** The saved fields in input form, used to merge edits. */
async function editableFields(row: OfferingRow): Promise<Record<string, unknown>> {
  const accepts = await db.select().from(tradeAccept).where(eq(tradeAccept.offeringId, row.id)).orderBy(asc(tradeAccept.position));
  const times = await db.select().from(serviceAvailability).where(eq(serviceAvailability.offeringId, row.id));
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
  const forType: Record<OfferingRow['type'], string[]> = {
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

type NotAgreed = 'open' | 'declined' | 'withdrawn' | 'closed';
function myArrangementOn(mine: { id: string; offeringId: string; status: string }[], offeringId: string) {
  const found = mine.find((p) => p.offeringId === offeringId && p.status !== 'agreed');
  return found ? { id: found.id, status: found.status as NotAgreed } : null;
}
