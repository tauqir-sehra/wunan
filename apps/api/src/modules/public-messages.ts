// Public threads (003 FR-023 to FR-023g, research §7): short messages on a request or an offering
// that every member can read and post in. Plain text, 1–240 characters. Only the author can remove
// a message; nobody can hide one. New messages and removals are announced on the thread's live
// channel. Notices go to the asker or lister and earlier posters, at most once a day per thread.
import { and, asc, desc, eq, inArray, isNull, lt, ne, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { flag, offering, member, publicMessage, request } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { notify } from '../notify/index.ts';
import { announce } from './live.ts';
import { shownName } from './members.ts';
import { loadRequest } from './requests.ts';

export type Subject = { requestId: string } | { offeringId: string };
type MessageRow = typeof publicMessage.$inferSelect;

const PAGE = 20;
const subjectIdOf = (subject: Subject) => ('requestId' in subject ? subject.requestId : subject.offeringId);

/** Who the thread belongs to, what it's called, and whether new messages can be posted. */
async function subjectInfo(subject: Subject) {
  if ('requestId' in subject) {
    const row = await loadRequest(subject.requestId);
    return { ownerId: row.askerId, title: row.title, canPost: row.status === 'open', url: `/requests/${row.id}`, closedMessage: 'This request is closed, so no new messages can be posted.' };
  }
  const [row] = await db.select().from(offering).where(eq(offering.id, subject.offeringId));
  if (!row) throw errors.notFound('That offering');
  return { ownerId: row.ownerId, title: row.title, canPost: row.status !== 'closed', url: `/offerings/${row.id}`, closedMessage: 'This offering is closed, so no new messages can be posted.' };
}

const whereSubject = (subject: Subject) =>
  'requestId' in subject ? eq(publicMessage.requestId, subject.requestId) : eq(publicMessage.offeringId, subject.offeringId);

/** Messages as the API returns them. The viewer's own messages carry the issues raised about them. */
async function present(rows: MessageRow[], viewerId: string) {
  if (rows.length === 0) return [];
  const authors = await db.select().from(member).where(inArray(member.id, [...new Set(rows.map((r) => r.authorId))]));
  const authorBy = new Map(authors.map((a) => [a.id, a]));
  const mine = rows.filter((r) => r.authorId === viewerId).map((r) => r.id);
  const flags = mine.length
    ? await db
        .select({ flag, from: { id: member.id, displayName: member.displayName, deletedAt: member.deletedAt } })
        .from(flag)
        .innerJoin(member, eq(member.id, flag.flaggedById))
        .where(inArray(flag.publicMessageId, mine))
        .orderBy(asc(flag.createdAt))
    : [];
  if (flags.length) await db.update(flag).set({ seenAt: new Date() }).where(and(inArray(flag.publicMessageId, mine), isNull(flag.seenAt)));
  return rows.map((row) => {
    const author = authorBy.get(row.authorId);
    const own = row.authorId === viewerId;
    return {
      id: row.id,
      author: { id: row.authorId, displayName: author ? shownName(author) : 'A member' },
      body: row.removedAt ? '' : row.body,
      removed: row.removedAt !== null,
      createdAt: row.createdAt.toISOString(),
      mine: own,
      ...(own
        ? {
            flags: flags
              .filter((f) => f.flag.publicMessageId === row.id)
              .map((f) => ({ id: f.flag.id, request: f.flag.request, from: { id: f.from.id, displayName: shownName(f.from) }, createdAt: f.flag.createdAt.toISOString() }))
          }
        : {})
    };
  });
}

/** The newest 20 messages (or the 20 before `before`), shown oldest first (FR-023b). */
export async function listThread(subject: Subject, viewerId: string, before?: string) {
  const info = await subjectInfo(subject);
  const conditions = [whereSubject(subject)];
  if (before) {
    const [anchor] = await db.select().from(publicMessage).where(and(eq(publicMessage.id, before), whereSubject(subject)));
    if (anchor) {
      conditions.push(or(lt(publicMessage.createdAt, anchor.createdAt), and(eq(publicMessage.createdAt, anchor.createdAt), lt(publicMessage.id, anchor.id)))!);
    }
  }
  const rows = await db
    .select()
    .from(publicMessage)
    .where(and(...conditions))
    .orderBy(desc(publicMessage.createdAt), desc(publicMessage.id))
    .limit(PAGE + 1);
  const page = rows.slice(0, PAGE).reverse();
  return { items: await present(page, viewerId), hasEarlier: rows.length > PAGE, canPost: info.canPost };
}

/** One message, for the live stream. */
export async function getPublicMessage(messageId: string, viewerId: string) {
  const [row] = await db.select().from(publicMessage).where(eq(publicMessage.id, messageId));
  return row ? (await present([row], viewerId))[0]! : null;
}

export async function postMessage(subject: Subject, authorId: string, body: string) {
  const info = await subjectInfo(subject);
  if (!info.canPost) throw new ApiError(409, 'thread_closed', info.closedMessage);
  // No limit for each thread (clarification 3); the shared message limit guards against abuse.
  await checkRateLimit(`message:${authorId}`, 60, 60);
  const [saved] = await db
    .insert(publicMessage)
    .values({ ...subject, authorId, body })
    .returning();
  const subjectId = subjectIdOf(subject);
  await announce(subjectId, saved!.id, 'public');

  // The asker or lister, and everyone who wrote here before, except the author.
  const posters = await db
    .selectDistinct({ authorId: publicMessage.authorId })
    .from(publicMessage)
    .where(and(whereSubject(subject), ne(publicMessage.authorId, authorId), isNull(publicMessage.removedAt)));
  const recipients = new Set([info.ownerId, ...posters.map((p) => p.authorId)]);
  recipients.delete(authorId);
  const [author] = await db.select().from(member).where(eq(member.id, authorId));
  for (const memberId of recipients) {
    await notify(memberId, 'public_message', {
      title: `New public message on “${info.title}”`,
      body: `${author ? shownName(author) : 'A member'}: ${body}`,
      url: `${info.url}#public-messages`,
      throttle: { subjectId, minutes: 24 * 60 }
    });
  }
  return { id: saved!.id };
}

/** The author removes their own message; it shows as "Message removed" (FR-023c). */
export async function removeMessage(messageId: string, memberId: string) {
  const [row] = await db.select().from(publicMessage).where(eq(publicMessage.id, messageId));
  if (!row) throw errors.notFound('That message');
  if (row.authorId !== memberId) throw new ApiError(403, 'not_author', 'Only the person who wrote this message can remove it.');
  if (row.removedAt) return;
  await db.update(publicMessage).set({ body: '', removedAt: new Date() }).where(eq(publicMessage.id, messageId));
  await announce((row.requestId ?? row.offeringId)!, messageId, 'public');
}

/** A written request to a message's author (FR-025). The message itself is unchanged. */
export async function flagMessage(messageId: string, memberId: string, text: string) {
  const [row] = await db.select().from(publicMessage).where(eq(publicMessage.id, messageId));
  if (!row || row.removedAt) throw errors.notFound('That message');
  if (row.authorId === memberId) throw new ApiError(400, 'own_message', 'This is your own message. You can remove it instead.');
  await checkRateLimit(`flag:${memberId}`, 10, 24 * 60);
  await db.insert(flag).values({ publicMessageId: messageId, flaggedById: memberId, request: text });
  const [sender] = await db.select().from(member).where(eq(member.id, memberId));
  const where = row.requestId ? `/requests/${row.requestId}` : `/offerings/${row.offeringId}`;
  await notify(row.authorId, 'flag', {
    title: `${sender ? shownName(sender) : 'A member'} sent a request about your message`,
    body: text,
    url: `${where}#public-messages`
  });
}

/** Checks the request or offering exists and can be seen, for the live stream. */
export async function requireThread(subject: Subject) {
  await subjectInfo(subject);
}

/** Every public message the member wrote, for their data export (FR-026). */
export async function messagesBy(memberId: string) {
  const rows = await db
    .select({ message: publicMessage, requestTitle: request.title, offeringTitle: offering.title })
    .from(publicMessage)
    .leftJoin(request, eq(request.id, publicMessage.requestId))
    .leftJoin(offering, eq(offering.id, publicMessage.offeringId))
    .where(eq(publicMessage.authorId, memberId))
    .orderBy(asc(publicMessage.createdAt));
  return rows.map(({ message: m, requestTitle, offeringTitle }) => ({
    id: m.id,
    on: m.requestId ? { request: m.requestId, title: requestTitle } : { offering: m.offeringId, title: offeringTitle },
    body: m.removedAt ? null : m.body,
    removed: m.removedAt !== null,
    createdAt: m.createdAt.toISOString()
  }));
}
