// Home (007): what needs a member right now, in four groups (spec FR-003 to FR-006, data-model.md),
// and pressing a line. Arrangements use the same rule as "Waiting on you"; offers on requests and
// requests to change something stay listed until their line is pressed on Home (`homePressedAt`),
// separately from `seenAt`, which keeps driving the header counts.
import type { HomePressed } from '@wunan/shared';
import { and, asc, eq, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { flag, member, offering, request, requestLink } from '../db/schema/index.ts';
import { errors } from '../lib/errors.ts';
import { startOfLocalDay } from '../lib/time.ts';
import { homeArrangements } from './arrangements.ts';
import { shownName } from './members.ts';

/** Loans due before the start of the day this many days ahead are "due back soon": today and 2 more. */
const DUE_BACK_DAYS = 3;

export async function homeFor(memberId: string, now = new Date()) {
  const [{ waiting, dueBack }, offers, askedToChange] = await Promise.all([
    homeArrangements(memberId, startOfLocalDay(now, DUE_BACK_DAYS)),
    offersOnMyRequests(memberId),
    askedToChangeMine(memberId)
  ]);
  return { arrangements: waiting, dueBack, offers, askedToChange };
}

/** Unpressed links on my open requests, by other members, to available offerings; one line per request. */
async function offersOnMyRequests(memberId: string) {
  const rows = await db
    .select({
      requestId: request.id,
      requestTitle: request.title,
      offeringId: offering.id,
      offeringTitle: offering.title,
      helper: { id: member.id, displayName: member.displayName, deletedAt: member.deletedAt },
      createdAt: requestLink.createdAt
    })
    .from(requestLink)
    .innerJoin(request, eq(request.id, requestLink.requestId))
    .innerJoin(offering, eq(offering.id, requestLink.offeringId))
    .innerJoin(member, eq(member.id, offering.ownerId))
    .where(
      and(
        eq(request.askerId, memberId),
        eq(request.status, 'open'),
        eq(offering.status, 'available'),
        isNull(requestLink.homePressedAt),
        or(isNull(requestLink.linkedById), ne(requestLink.linkedById, memberId)),
        ne(offering.ownerId, memberId)
      )
    )
    .orderBy(asc(requestLink.createdAt), asc(requestLink.id));

  const byRequest = new Map<string, typeof rows>();
  for (const row of rows) byRequest.set(row.requestId, [...(byRequest.get(row.requestId) ?? []), row]);
  return [...byRequest.values()].map((links) => {
    const first = links[0]!;
    const helpers = new Map(links.map((l) => [l.helper.id, { id: l.helper.id, displayName: shownName(l.helper) }]));
    return {
      request: { id: first.requestId, title: first.requestTitle },
      count: links.length,
      helpers: [...helpers.values()],
      firstOffering: { id: first.offeringId, title: first.offeringTitle },
      since: first.createdAt.toISOString()
    };
  });
}

/** Unpressed requests to change my offerings and requests (not public messages); one line per thing. */
async function askedToChangeMine(memberId: string) {
  const [onOfferings, onRequests] = await Promise.all([
    db
      .select({ id: offering.id, title: offering.title, count: sql<number>`count(*)::int`, since: sql<Date>`min(${flag.createdAt})` })
      .from(flag)
      .innerJoin(offering, eq(offering.id, flag.offeringId))
      .where(and(eq(offering.ownerId, memberId), isNull(flag.homePressedAt)))
      .groupBy(offering.id, offering.title),
    db
      .select({ id: request.id, title: request.title, count: sql<number>`count(*)::int`, since: sql<Date>`min(${flag.createdAt})` })
      .from(flag)
      .innerJoin(request, eq(request.id, flag.requestId))
      .where(and(eq(request.askerId, memberId), isNull(flag.homePressedAt)))
      .groupBy(request.id, request.title)
  ]);
  return [
    ...onOfferings.map((r) => ({ subject: 'offering' as const, ...r })),
    ...onRequests.map((r) => ({ subject: 'request' as const, ...r }))
  ]
    .map((r) => ({ ...r, since: new Date(r.since).toISOString() }))
    .sort((a, b) => a.since.localeCompare(b.since));
}

/** Marks a Home line pressed: only my own request or thing (else 404), only what's still unpressed. */
export async function markPressed(memberId: string, body: HomePressed) {
  const now = new Date();
  if (body.kind === 'offers') {
    const [mine] = await db.select({ id: request.id }).from(request).where(and(eq(request.id, body.requestId), eq(request.askerId, memberId)));
    if (!mine) throw errors.notFound('That');
    await db
      .update(requestLink)
      .set({ homePressedAt: now })
      .where(and(eq(requestLink.requestId, body.requestId), isNull(requestLink.homePressedAt)));
    return;
  }
  if (body.subject === 'offering') {
    const [mine] = await db.select({ id: offering.id }).from(offering).where(and(eq(offering.id, body.id), eq(offering.ownerId, memberId)));
    if (!mine) throw errors.notFound('That');
    await db.update(flag).set({ homePressedAt: now }).where(and(eq(flag.offeringId, body.id), isNull(flag.homePressedAt)));
    return;
  }
  const [mine] = await db.select({ id: request.id }).from(request).where(and(eq(request.id, body.id), eq(request.askerId, memberId)));
  if (!mine) throw errors.notFound('That');
  await db.update(flag).set({ homePressedAt: now }).where(and(eq(flag.requestId, body.id), isNull(flag.homePressedAt)));
}
