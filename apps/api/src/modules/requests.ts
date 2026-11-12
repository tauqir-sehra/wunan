// Requests (003): a member asks for something; others answer by linking an offering (made for it, or
// one they have); the asker's arrangement on a linked offering closes it once agreed (research §1–§6).
// Only the asker changes a request. Links never change an offering, and closing a request never
// changes its linked offerings. Areas go out through viewPlace(), in full only for the asker.
import { CreateRequest, offeringTypeFor, type RequestKind, type RequestSearchQuery } from '@wunan/shared';
import { and, asc, count, desc, eq, inArray, isNull, ne, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { arrangement, flag, offering, member, request, requestAvailability, requestGiveBack, requestLink } from '../db/schema/index.ts';
import { ApiError, errors, validationError } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { instantToLocal } from '../lib/time.ts';
import { notify } from '../notify/index.ts';
import { describe as describeOfferings, lentOutNow, trimDecimal } from './offerings.ts';
import { shownName } from './members.ts';
import { viewPlace } from './places.ts';

type RequestRow = typeof request.$inferSelect;
type Values = typeof request.$inferInsert;
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Request notices: at most one per request per member per hour (contracts/notifications.md). */
const requestThrottle = (requestId: string) => ({ subjectId: requestId, minutes: 60 });

/** Turns validated input into table values; every field not used by the kind is null. */
function toValues(input: CreateRequest): Omit<Values, 'askerId'> {
  const base = {
    kind: input.kind,
    title: input.title,
    description: input.description ?? null,
    neededAfter: input.neededAfter ?? null,
    neededBy: input.neededBy ?? null,
    area: input.area ?? null,
    handovers: input.handovers ?? [],
    loanLength: null as number | null,
    loanLengthUnit: null as Values['loanLengthUnit'],
    amount: null as string | null,
    unit: null as Values['unit'],
    sessionLength: null as number | null,
    sessionLengthUnit: null as Values['sessionLengthUnit'],
    sessions: null as number | null
  };
  switch (input.kind) {
    case 'borrow':
      return { ...base, loanLength: input.loanLength ?? null, loanLengthUnit: input.loanLengthUnit ?? null };
    case 'receive':
    case 'trade':
      return { ...base, amount: input.amount ?? null, unit: input.unit ?? null };
    case 'service':
      return { ...base, sessionLength: input.sessionLength ?? null, sessionLengthUnit: input.sessionLengthUnit ?? null, sessions: input.sessions ?? null };
  }
}

/** Saves a Trade's give-back items and a Service's times, replacing what was there, and the search words. */
async function saveRows(tx: Transaction, requestId: string, input: CreateRequest) {
  await tx.delete(requestGiveBack).where(eq(requestGiveBack.requestId, requestId));
  await tx.delete(requestAvailability).where(eq(requestAvailability.requestId, requestId));
  if (input.kind === 'trade' && input.giveBack?.length) {
    await tx.insert(requestGiveBack).values(
      input.giveBack.map((item, position) => ({ requestId, position, description: item.description, amount: item.amount ?? null, unit: item.unit ?? null }))
    );
  }
  if (input.kind === 'service' && input.availability?.length) {
    await tx.insert(requestAvailability).values(input.availability.map((row) => ({ requestId, ...row })));
  }
  // The title counts most, then the description and what a trade asker could give back.
  await tx.execute(sql`
    update request set search_vector =
      setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '') || ' ' || coalesce(
        (select string_agg(description, ' ') from request_give_back where request_id = ${requestId}), '')), 'B')
    where id = ${requestId}`);
}

export async function createRequest(askerId: string, input: CreateRequest) {
  const id = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(request)
      .values({ ...toValues(input), askerId })
      .returning({ id: request.id });
    await saveRows(tx, created!.id, input);
    return created!.id;
  });
  return { id };
}

/** A request anyone signed in may see; one closed because its asker left is gone for everyone. */
export async function loadRequest(requestId: string): Promise<RequestRow> {
  const [row] = await db.select().from(request).where(eq(request.id, requestId));
  if (!row || row.closedReason === 'account_deleted') throw errors.notFound('That request');
  return row;
}

async function askersRequest(requestId: string, memberId: string) {
  const row = await loadRequest(requestId);
  if (row.askerId !== memberId) throw new ApiError(403, 'not_asker', 'Only the person who asked can change this request.');
  return row;
}

const notNow = (message: string) => new ApiError(409, 'not_possible_now', message);

/** The saved request as create input, so an edit can be merged and checked in full. */
async function editableFields(row: RequestRow) {
  const [giveBack, times] = await Promise.all([
    db.select().from(requestGiveBack).where(eq(requestGiveBack.requestId, row.id)).orderBy(asc(requestGiveBack.position)),
    db.select().from(requestAvailability).where(eq(requestAvailability.requestId, row.id))
  ]);
  const fields: Record<string, unknown> = {
    title: row.title,
    description: row.description,
    neededAfter: row.neededAfter,
    neededBy: row.neededBy,
    area: row.area,
    handovers: row.handovers
  };
  if (row.kind === 'borrow') Object.assign(fields, { loanLength: row.loanLength, loanLengthUnit: row.loanLengthUnit });
  if (row.kind === 'receive' || row.kind === 'trade') Object.assign(fields, { amount: trimDecimal(row.amount), unit: row.unit });
  if (row.kind === 'trade') fields.giveBack = giveBack.map((g) => ({ description: g.description, amount: trimDecimal(g.amount), unit: g.unit }));
  if (row.kind === 'service') {
    Object.assign(fields, { sessionLength: row.sessionLength, sessionLengthUnit: row.sessionLengthUnit, sessions: row.sessions });
    fields.availability = times.map((t) => ({ weekday: t.weekday, startTime: t.startTime.slice(0, 5), endTime: t.endTime.slice(0, 5) }));
  }
  return fields;
}

/** Plain names of the details that changed, for the notice to helpers. */
const fieldWords: Record<string, string> = {
  title: 'the title',
  description: 'the description',
  neededAfter: 'when it’s needed',
  neededBy: 'when it’s needed',
  area: 'the area',
  handovers: 'how it could happen',
  loanLength: 'how long',
  loanLengthUnit: 'how long',
  amount: 'how much',
  unit: 'how much',
  giveBack: 'what could be given back',
  sessionLength: 'how long each time',
  sessionLengthUnit: 'how long each time',
  sessions: 'how many times',
  availability: 'the times that suit'
};

export async function updateRequest(requestId: string, askerId: string, changes: Record<string, unknown>) {
  const current = await askersRequest(requestId, askerId);
  if (current.status !== 'open') throw notNow('This request is closed. You can reopen it first.');
  const before = await editableFields(current);
  const parsed = CreateRequest.safeParse({ ...before, ...changes, kind: current.kind });
  if (!parsed.success) throw validationError(parsed.error);

  await db.transaction(async (tx) => {
    await tx.update(request).set({ ...toValues(parsed.data), updatedAt: new Date() }).where(eq(request.id, requestId));
    await saveRows(tx, requestId, parsed.data);
  });

  const after = await editableFields(await loadRequest(requestId));
  const changed = [...new Set(Object.keys(after).filter((key) => JSON.stringify(after[key]) !== JSON.stringify(before[key])).map((key) => fieldWords[key] ?? key))];
  if (changed.length) {
    await notifyHelpers(current, askerId, {
      title: `${await nameOf(askerId)} changed their request “${current.title}”`,
      body: `They changed ${changed.join(', ')}.`
    });
  }
  return getRequest(requestId, askerId);
}

export async function closeRequest(requestId: string, askerId: string) {
  const current = await askersRequest(requestId, askerId);
  if (current.status !== 'open') throw notNow('This request is already closed.');
  await db.update(request).set({ status: 'closed', closedReason: 'by_asker', updatedAt: new Date() }).where(eq(request.id, requestId));
  await notifyHelpers(current, askerId, {
    title: `${await nameOf(askerId)}'s request “${current.title}” is closed`,
    body: 'Your offering stays up as usual.'
  });
  return getRequest(requestId, askerId);
}

export async function reopenRequest(requestId: string, askerId: string) {
  const current = await askersRequest(requestId, askerId);
  if (current.status !== 'closed') throw notNow('This request is already open.');
  await db
    .update(request)
    .set({ status: 'open', closedReason: null, closedByArrangementId: null, updatedAt: new Date() })
    .where(eq(request.id, requestId));
  await notifyHelpers(current, askerId, {
    title: `${await nameOf(askerId)}'s request “${current.title}” is open again`,
    body: 'They are still looking. Your offering is still linked to it.'
  });
  return getRequest(requestId, askerId);
}

/**
 * Closes the request because the asker's arrangement on a linked offering was agreed (research §3).
 * Runs inside the accept transaction; returns the request when it closed, so the caller can tell
 * the other helpers once the transaction is done.
 */
export async function closeForArrangement(tx: Transaction, requestId: string, arrangementId: string) {
  const [closed] = await tx
    .update(request)
    .set({ status: 'closed', closedReason: 'agreed', closedByArrangementId: arrangementId, updatedAt: new Date() })
    .where(and(eq(request.id, requestId), eq(request.status, 'open')))
    .returning();
  return closed ?? null;
}

/** After an agreement closed a request: tell the members whose offerings were linked, but not the lister who accepted. */
export async function announceSettled(row: RequestRow, listerId: string) {
  await notifyHelpers(row, listerId, {
    title: `${await nameOf(row.askerId)}'s request “${row.title}” is settled`,
    body: 'They agreed on something. Your offering stays up as usual.'
  });
}

async function nameOf(memberId: string) {
  const [row] = await db.select().from(member).where(eq(member.id, memberId));
  return row ? shownName(row) : 'A member';
}

/** Members whose offerings are linked to the request (the helpers), except whoever did it. */
async function notifyHelpers(row: RequestRow, actorId: string, notice: { title: string; body: string }) {
  const owners = await db
    .selectDistinct({ ownerId: offering.ownerId })
    .from(requestLink)
    .innerJoin(offering, eq(offering.id, requestLink.offeringId))
    .where(eq(requestLink.requestId, row.id));
  for (const { ownerId } of owners) {
    if (ownerId === actorId || ownerId === row.askerId) continue;
    await notify(ownerId, 'request', { ...notice, url: `/requests/${row.id}`, throttle: requestThrottle(row.id) });
  }
}

/** "Needed by" is before today in the community's time zone. */
const datePassed = (row: RequestRow) => Boolean(row.neededBy && row.neededBy < instantToLocal(new Date()).date);

/** Summaries for lists: asker, area (full only for the asker), and how many offerings are linked. */
async function summarise(rows: RequestRow[], viewerId: string, withUnseenFlags = false) {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [askers, links, unseen] = await Promise.all([
    db.select().from(member).where(inArray(member.id, [...new Set(rows.map((r) => r.askerId))])),
    db.select({ requestId: requestLink.requestId, n: count() }).from(requestLink).where(inArray(requestLink.requestId, ids)).groupBy(requestLink.requestId),
    withUnseenFlags
      ? db.select({ requestId: flag.requestId, n: count() }).from(flag).where(and(inArray(flag.requestId, ids), isNull(flag.seenAt))).groupBy(flag.requestId)
      : Promise.resolve([] as { requestId: string | null; n: number }[])
  ]);
  const askerBy = new Map(askers.map((a) => [a.id, a]));
  const linksBy = new Map(links.map((l) => [l.requestId, l.n]));
  const unseenBy = new Map(unseen.map((u) => [u.requestId, u.n]));
  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    area: viewPlace(row.area, { full: row.askerId === viewerId }),
    neededAfter: row.neededAfter,
    neededBy: row.neededBy,
    asker: { id: row.askerId, displayName: shownName(askerBy.get(row.askerId)!) },
    status: row.status,
    closedReason: row.closedReason,
    linkCount: linksBy.get(row.id) ?? 0,
    ...(withUnseenFlags ? { unseenFlags: unseenBy.get(row.id) ?? 0 } : {}),
    createdAt: row.createdAt.toISOString()
  }));
}

/** The full request. The asker also gets flags (marked seen) and, once settled, their other open arrangements. */
export async function getRequest(requestId: string, viewerId: string) {
  const row = await loadRequest(requestId);
  const isAsker = row.askerId === viewerId;
  const [[summary], giveBack, times, links] = await Promise.all([
    summarise([row], viewerId),
    db.select().from(requestGiveBack).where(eq(requestGiveBack.requestId, requestId)).orderBy(asc(requestGiveBack.position)),
    db
      .select()
      .from(requestAvailability)
      .where(eq(requestAvailability.requestId, requestId))
      .orderBy(asc(requestAvailability.weekday), asc(requestAvailability.startTime)),
    linksOf(requestId, viewerId, row.askerId === viewerId)
  ]);

  const result = {
    ...summary!,
    description: row.description,
    handovers: row.handovers,
    loanLength: row.loanLength,
    loanLengthUnit: row.loanLengthUnit,
    amount: trimDecimal(row.amount),
    unit: row.unit,
    giveBack: giveBack.map((g) => ({ description: g.description, amount: trimDecimal(g.amount), unit: g.unit })),
    sessionLength: row.sessionLength,
    sessionLengthUnit: row.sessionLengthUnit,
    sessions: row.sessions,
    availability: times.map((t) => ({ weekday: t.weekday, startTime: t.startTime.slice(0, 5), endTime: t.endTime.slice(0, 5) })),
    datePassed: isAsker && row.status === 'open' && datePassed(row),
    closedByArrangementId: isAsker ? row.closedByArrangementId : null,
    links,
    canAnswer: row.status === 'open' && !isAsker,
    canEdit: row.status === 'open' && isAsker
  };
  if (!isAsker) return result;
  return { ...result, flags: await flagsFor(requestId), myOtherOpenArrangements: await otherOpenArrangements(row) };
}

/** The offerings linked to a request, with whether they're still available and who may remove each
    link: who made it, the offering's owner ("Withdraw this offer"), or the asker ("Not for my request"). */
async function linksOf(requestId: string, viewerId: string, isAsker: boolean) {
  const rows = await db
    .select({ link: requestLink, offering: { id: offering.id, title: offering.title, type: offering.type, status: offering.status, ownerId: offering.ownerId } })
    .from(requestLink)
    .innerJoin(offering, eq(offering.id, requestLink.offeringId))
    .where(eq(requestLink.requestId, requestId))
    .orderBy(asc(requestLink.createdAt));
  if (rows.length === 0) return [];
  const peopleIds = [...new Set(rows.flatMap((r) => [r.offering.ownerId, r.link.linkedById].filter((v): v is string => Boolean(v))))];
  const people = await db.select().from(member).where(inArray(member.id, peopleIds));
  const personBy = new Map(people.map((p) => [p.id, p]));
  const ref = (id: string | null) => (id && personBy.get(id) ? { id, displayName: shownName(personBy.get(id)!) } : null);
  return rows.map(({ link, offering: l }) => ({
    id: link.id,
    offering: { id: l.id, title: l.title, type: l.type, status: l.status, owner: ref(l.ownerId)! },
    linkedBy: ref(link.linkedById),
    available: l.status === 'available',
    canRemove: isAsker || link.linkedById === viewerId || l.ownerId === viewerId
  }));
}

async function flagsFor(requestId: string) {
  const rows = await db
    .select({ flag, from: { id: member.id, displayName: member.displayName, deletedAt: member.deletedAt } })
    .from(flag)
    .innerJoin(member, eq(member.id, flag.flaggedById))
    .where(eq(flag.requestId, requestId))
    .orderBy(desc(flag.createdAt));
  await db.update(flag).set({ seenAt: new Date() }).where(and(eq(flag.requestId, requestId), isNull(flag.seenAt)));
  return rows.map(({ flag: f, from }) => ({
    id: f.id,
    request: f.request,
    from: { id: from.id, displayName: shownName(from) },
    createdAt: f.createdAt.toISOString(),
    seen: f.seenAt !== null
  }));
}

/** After an agreement closed the request: the asker's arrangements still open on its other linked offerings. */
async function otherOpenArrangements(row: RequestRow) {
  if (row.closedReason !== 'agreed') return [];
  return db
    .select({ id: arrangement.id, offeringTitle: offering.title })
    .from(arrangement)
    .innerJoin(offering, eq(offering.id, arrangement.offeringId))
    .innerJoin(requestLink, and(eq(requestLink.offeringId, arrangement.offeringId), eq(requestLink.requestId, row.id)))
    .where(and(eq(arrangement.requesterId, row.askerId), eq(arrangement.status, 'open')));
}

/** Escapes % and _ so an area like "100%" is matched literally. */
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/**
 * Open requests by others, newest first (FR-020), or the caller's own with `mine` (open first, then
 * closed). Paged with an offset cursor.
 */
export async function listRequests(query: RequestSearchQuery, viewerId: string) {
  const conditions: SQL[] = [];
  if (query.mine) {
    // Open requests have no closed reason, so "not account_deleted" must allow null too.
    conditions.push(eq(request.askerId, viewerId), sql`${request.closedReason} is distinct from 'account_deleted'`);
  } else {
    conditions.push(eq(request.status, 'open'), ne(request.askerId, viewerId));
  }
  if (query.q) conditions.push(sql`${request.searchVector} @@ websearch_to_tsquery('english', ${query.q})`);
  if (query.kind && query.kind.length && query.kind.length < 4) conditions.push(inArray(request.kind, query.kind));
  if (query.area) {
    const pattern = likePattern(query.area);
    conditions.push(sql`(${request.areaNeighbourhood} ilike ${pattern} or ${request.areaCity} ilike ${pattern}
      or (${request.area}->>'source' = 'typed' and ${request.area}->>'label' ilike ${pattern}))`);
  }
  const offset = Math.max(0, Number(query.cursor ?? 0) || 0);
  const order = query.mine ? [asc(request.status), desc(request.createdAt), desc(request.id)] : [desc(request.createdAt), desc(request.id)];
  const rows = await db
    .select()
    .from(request)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(query.limit + 1)
    .offset(offset);
  const page = rows.slice(0, query.limit);
  return {
    items: await summarise(page, viewerId, query.mine),
    nextCursor: rows.length > query.limit ? String(offset + query.limit) : null
  };
}

/** Unseen issues raised about the member's requests, for the counts on "My requests" (FR-022). */
export async function countUnseenRequestFlags(memberId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(flag)
    .innerJoin(request, eq(request.id, flag.requestId))
    .where(and(eq(request.askerId, memberId), isNull(flag.seenAt)));
  return row?.n ?? 0;
}

/**
 * Up to 5 available offerings that might already answer a request being written (FR-009):
 * matching words, of the type that answers the kind, not lent out, not the asker's own; those in
 * the same neighbourhood or city first when an area is given.
 */
export async function suggestOfferings(input: { kind: RequestKind; q: string; area?: string | undefined }, viewerId: string) {
  if (input.q.length < 3) return { items: [] };
  const words = sql`websearch_to_tsquery('english', ${input.q})`;
  const conditions: SQL[] = [
    eq(offering.status, 'available'),
    eq(offering.type, offeringTypeFor[input.kind]),
    ne(offering.ownerId, viewerId),
    sql`not ${lentOutNow}`,
    sql`${offering.searchVector} @@ ${words}`
  ];
  const order: SQL[] = [desc(sql`ts_rank(${offering.searchVector}, ${words})`), desc(offering.createdAt)];
  if (input.area) {
    const pattern = likePattern(input.area);
    order.unshift(sql`case when ${offering.areaNeighbourhood} ilike ${pattern} or ${offering.areaCity} ilike ${pattern} then 0 else 1 end`);
  }
  const rows = await db
    .select()
    .from(offering)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(5);
  return { items: await describeOfferings(rows, viewerId) };
}

/**
 * Links an offering to a request as possibly answering it (research §2): the offering's owner (a
 * helper), or the asker linking an offering they found. The offering must be available and of the type
 * that answers the request's kind.
 */
export async function linkOffering(requestId: string, offeringId: string, memberId: string) {
  const row = await loadRequest(requestId);
  if (row.status !== 'open') throw new ApiError(409, 'request_closed', 'This request is closed, so nothing more can be linked to it.');
  const [item] = await db.select().from(offering).where(eq(offering.id, offeringId));
  if (!item) throw errors.notFound('That offering');
  const isAsker = row.askerId === memberId;
  if (item.ownerId === row.askerId) throw new ApiError(403, 'own_request', "You can't answer your own request with your own offering.");
  if (!isAsker && item.ownerId !== memberId) throw new ApiError(403, 'not_owner', 'You can only link your own offerings.');
  if (item.type !== offeringTypeFor[row.kind]) {
    throw new ApiError(400, 'wrong_type', `Only a ${offeringTypeFor[row.kind]} offering can answer this request.`);
  }
  if (item.status !== 'available') throw new ApiError(409, 'not_available', 'That offering isn’t available right now, so it can’t be linked.');
  const [created] = await db
    .insert(requestLink)
    .values({ requestId, offeringId, linkedById: memberId })
    .onConflictDoNothing()
    .returning({ id: requestLink.id });
  if (!created) throw new ApiError(409, 'already_linked', 'That offering is already linked to this request.');
  if (!isAsker) {
    await notify(row.askerId, 'request', {
      title: `${await nameOf(memberId)} can help with “${row.title}”`,
      body: `They linked their offering “${item.title}” to your request.`,
      url: `/requests/${requestId}`,
      throttle: requestThrottle(requestId)
    });
  }
  return { id: created.id };
}

/** Removes a link; who made it, the offering's owner, or the asker can (FR-017a). The offering is unchanged. */
export async function unlinkOffering(requestId: string, linkId: string, memberId: string) {
  const [row] = await db
    .select({ link: requestLink, ownerId: offering.ownerId, askerId: request.askerId })
    .from(requestLink)
    .innerJoin(offering, eq(offering.id, requestLink.offeringId))
    .innerJoin(request, eq(request.id, requestLink.requestId))
    .where(and(eq(requestLink.id, linkId), eq(requestLink.requestId, requestId)));
  if (!row) throw errors.notFound('That link');
  if (row.link.linkedById !== memberId && row.ownerId !== memberId && row.askerId !== memberId) {
    throw new ApiError(403, 'not_allowed', 'Only the person who asked, who linked it, or the offering’s owner can remove this link.');
  }
  await db.delete(requestLink).where(eq(requestLink.id, linkId));
}

/** Another member's written request to the asker (FR-025). The request itself is unchanged. */
export async function flagRequest(requestId: string, memberId: string, text: string) {
  const row = await loadRequest(requestId);
  if (row.askerId === memberId) throw new ApiError(400, 'own_request', 'This is your own request. You can edit it instead.');
  await checkRateLimit(`flag:${memberId}`, 10, 24 * 60);
  await db.insert(flag).values({ requestId, flaggedById: memberId, request: text });
  await notify(row.askerId, 'flag', {
    title: `${await nameOf(memberId)} sent a request about your request`,
    body: text,
    url: `/requests/${requestId}`
  });
}
