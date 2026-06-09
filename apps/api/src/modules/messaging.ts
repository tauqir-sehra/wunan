// Threads of messages (001 FR-018 to FR-020; 002 FR-022 to FR-025): each belongs to a proposal or a
// problem report. Sending, sharing chosen contact details, agreeing a call time, and the notes the
// API writes when a proposal changes. There is no inbox and no way to start a thread directly.
import { and, desc, eq, gt, inArray, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import type { SendMessage } from '@wunan/shared';
import { db } from '../db/index.ts';
import { conversation, conversationParticipant, offering, member, message, proposal } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { notify } from '../notify/index.ts';
import { announce, isConnected } from './live.ts';
import { getContact, shownName } from './members.ts';

type MessageRow = typeof message.$inferSelect;

/**
 * Who may use a thread: its participants read and write; mediators of a problem report may read
 * (never write) the agreement's proposal thread once the reporter or reported member shared it
 * (002 FR-022a). Anyone else gets "not found". Writing also needs the thread to be open: a proposal
 * that was declined, withdrawn, or closed is read-only (002 FR-022b).
 */
export async function requireAccess(conversationId: string, memberId: string, { write }: { write: boolean }) {
  const [row] = await db
    .select({ id: conversationParticipant.id, lastReadAt: conversationParticipant.lastReadAt })
    .from(conversationParticipant)
    .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.memberId, memberId)));
  if (row) {
    if (write && !(await isWritable(conversationId))) {
      throw new ApiError(409, 'thread_closed', 'This proposal has ended, so no new messages can be added.');
    }
    return { ...row, participant: true };
  }
  if (await canReadShared(conversationId, memberId)) {
    if (write) throw new ApiError(403, 'read_only', 'You can read these messages, but only the two members can write here.');
    return { id: null, lastReadAt: null, participant: false };
  }
  throw errors.notFound('That conversation');
}

/** Kept for callers that only deal with participants (contact sharing, calls, read state). */
export const requireParticipant = (conversationId: string, memberId: string) => requireAccess(conversationId, memberId, { write: false }).then((access) => {
  if (!access.participant) throw errors.notFound('That conversation');
  return access;
});

async function isWritable(conversationId: string) {
  const [row] = await db
    .select({ status: proposal.status })
    .from(conversation)
    .leftJoin(proposal, eq(proposal.id, conversation.proposalId))
    .where(eq(conversation.id, conversationId));
  return !row?.status || row.status === 'open' || row.status === 'accepted';
}

/** A mediator of a report whose proposal messages were shared, reading that proposal's thread. */
async function canReadShared(conversationId: string, memberId: string) {
  const rows = await db.execute(sql`
    select 1 from conversation c
      join agreement a on a.proposal_id = c.proposal_id
      join problem_report r on r.agreement_id = a.id and r.proposal_messages_shared_at is not null
      join conversation rc on rc.problem_report_id = r.id
      join conversation_participant rp on rp.conversation_id = rc.id and rp.member_id = ${memberId}
     where c.id = ${conversationId} and ${memberId} <> r.reporter_id and ${memberId} <> r.reported_member_id
     limit 1`);
  return rows.length > 0;
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Starts the thread of a proposal or a problem report with its participants. */
export async function createThread(tx: Transaction, owner: { proposalId: string } | { problemReportId: string }, participantIds: string[]) {
  const [created] = await tx.insert(conversation).values(owner).returning();
  await tx.insert(conversationParticipant).values([...new Set(participantIds)].map((memberId) => ({ conversationId: created!.id, memberId })));
  return created!;
}

export async function getConversation(conversationId: string, memberId: string) {
  const access = await requireAccess(conversationId, memberId, { write: false });
  const [row] = await db.select().from(conversation).where(eq(conversation.id, conversationId));
  return summarise(row!, memberId, access.lastReadAt, access.participant && (await isWritable(conversationId)));
}

async function summarise(c: typeof conversation.$inferSelect, memberId: string, lastReadAt: Date | null, canWrite: boolean) {
  const people = await db
    .select({ id: member.id, displayName: member.displayName, deletedAt: member.deletedAt })
    .from(conversationParticipant)
    .innerJoin(member, eq(member.id, conversationParticipant.memberId))
    .where(and(eq(conversationParticipant.conversationId, c.id), ne(conversationParticipant.memberId, memberId)));
  const [item] = c.proposalId
    ? await db.select({ id: offering.id, title: offering.title }).from(proposal).innerJoin(offering, eq(offering.id, proposal.offeringId)).where(eq(proposal.id, c.proposalId))
    : [];
  const [last] = await db.select().from(message).where(eq(message.conversationId, c.id)).orderBy(desc(message.createdAt)).limit(1);
  const [unread] = await db
    .select({ id: message.id })
    .from(message)
    .where(
      and(
        eq(message.conversationId, c.id),
        or(isNull(message.authorId), ne(message.authorId, memberId)),
        lastReadAt ? gt(message.createdAt, lastReadAt) : undefined
      )
    )
    .limit(1);
  const lastAuthor = last?.authorId ? (await db.select().from(member).where(eq(member.id, last.authorId)))[0] : undefined;
  return {
    id: c.id,
    participants: people.map((p) => ({ id: p.id, displayName: shownName(p) })),
    offering: item ?? null,
    isMediation: c.problemReportId !== null,
    proposalId: c.proposalId,
    canWrite,
    lastMessage: last
      ? { preview: preview(last), createdAt: last.createdAt.toISOString(), author: lastAuthor ? { id: lastAuthor.id, displayName: shownName(lastAuthor) } : null }
      : null,
    unread: Boolean(unread)
  };
}

/** Newest first, a page at a time. */
export async function listMessages(conversationId: string, memberId: string, cursor: string | undefined, limit = 50) {
  await requireAccess(conversationId, memberId, { write: false });
  const before = cursor ? new Date(cursor) : null;
  const rows = await db
    .select()
    .from(message)
    .where(and(eq(message.conversationId, conversationId), before && !Number.isNaN(before.getTime()) ? lt(message.createdAt, before) : undefined))
    .orderBy(desc(message.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    conversation: await getConversation(conversationId, memberId),
    items: await toJson(page),
    nextCursor: rows.length > limit ? page.at(-1)!.createdAt.toISOString() : null
  };
}

/** One message as the API returns it (used by the live stream). */
export async function getMessage(messageId: string) {
  const [row] = await db.select().from(message).where(eq(message.id, messageId));
  if (!row) return null;
  const [json] = await toJson([row]);
  return json ?? null;
}

/**
 * Sends one message: its text, plus anything added with "+": exactly the chosen saved contact
 * details (FR-019) and a suggested time to call (FR-020).
 */
export async function sendMessage(conversationId: string, memberId: string, input: SendMessage) {
  await requireAccess(conversationId, memberId, { write: true });
  await checkRateLimit(`message:${memberId}`, 60, 60);
  const values: PostValues = { kind: 'text', body: input.body };
  if (input.contact?.phone || input.contact?.email) {
    const saved = await getContact(memberId);
    const missing = (what: string) =>
      new ApiError(400, 'contact_not_saved', `You haven't saved ${what} yet. Add it in Settings first.`);
    if (input.contact.phone) {
      if (!saved.sharePhone) throw missing('a phone number');
      values.sharedPhone = saved.sharePhone;
    }
    if (input.contact.email) {
      if (!saved.shareEmail) throw missing('an email to share');
      values.sharedEmail = saved.shareEmail;
    }
  }
  if (input.proposedTime) {
    const time = new Date(input.proposedTime);
    if (time.getTime() < Date.now())
      throw new ApiError(400, 'validation_failed', 'Some details need fixing.', { proposedTime: 'Please choose a time that is still to come.' });
    values.proposedTime = time;
  }
  return post(conversationId, memberId, values);
}

/** The other person accepts a proposed time (FR-020). To suggest another time, they propose one. */
export async function acceptCall(conversationId: string, memberId: string, callMessageId: string) {
  await requireAccess(conversationId, memberId, { write: true });
  const [suggested] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, callMessageId), eq(message.conversationId, conversationId), eq(message.kind, 'text'), isNotNull(message.proposedTime)));
  if (!suggested) throw errors.notFound('That call time');
  if (suggested.authorId === memberId) throw new ApiError(400, 'own_proposal', 'The other person needs to accept the time you suggested.');
  if ((await acceptedProposals([suggested])).has(suggested.id)) throw new ApiError(409, 'already_accepted', 'This call time was already accepted.');
  return post(conversationId, memberId, { kind: 'call_accepted', proposedTime: suggested.proposedTime });
}

export async function markRead(conversationId: string, memberId: string) {
  await requireParticipant(conversationId, memberId);
  await db
    .update(conversationParticipant)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.memberId, memberId)));
}

/** Proposals and reports with something I haven't read yet, for the quiet count on home. */
export async function countThreadsWithNews(memberId: string) {
  const [row] = await db.execute<{ unread: number }>(sql`
    select count(*)::int as unread from conversation_participant p
     where p.member_id = ${memberId}
       and exists (select 1 from message m
                    where m.conversation_id = p.conversation_id
                      and (m.author_id is null or m.author_id <> ${memberId})
                      and (p.last_read_at is null or m.created_at > p.last_read_at))`);
  return row?.unread ?? 0;
}

/** Adds a system message, e.g. "Alex's inviter has joined to help" (used by problem reports). */
export async function postSystemMessage(conversationId: string, body: string) {
  return post(conversationId, null, { kind: 'system', body });
}

type PostValues = Pick<MessageRow, 'kind'> & Partial<Pick<MessageRow, 'body' | 'proposedTime' | 'sharedPhone' | 'sharedEmail'>>;
/** Who to tell about a note, and how; `false` tells nobody (the caller sends its own notices). */
type NoticeOverride = false | { title: string; body?: string; to?: string[] };

/**
 * Saves a note the API writes into a proposal's thread (a detail change, acceptance, decline, …).
 * `notice` replaces the usual "New message" notification, or `false` skips it.
 */
export async function postEvent(conversationId: string, authorId: string | null, values: PostValues, notice: NoticeOverride = false) {
  return post(conversationId, authorId, values, notice);
}

/** Saves a message, tells open streams, and notifies participants who don't have it open. */
async function post(conversationId: string, authorId: string | null, values: PostValues, notice?: NoticeOverride) {
  const [saved] = await db
    .insert(message)
    .values({
      conversationId,
      authorId,
      kind: values.kind,
      body: values.body ?? '',
      sharedPhone: values.sharedPhone ?? null,
      sharedEmail: values.sharedEmail ?? null,
      proposedTime: values.proposedTime ?? null
    })
    .returning();
  await db.update(conversation).set({ lastMessageAt: saved!.createdAt }).where(eq(conversation.id, conversationId));
  const [c] = await db.select().from(conversation).where(eq(conversation.id, conversationId));
  // Activity keeps a proposal from closing after a quiet month (002 FR-020a).
  if (c?.proposalId) await db.update(proposal).set({ lastActivityAt: saved!.createdAt }).where(eq(proposal.id, c.proposalId));
  await announce(conversationId, saved!.id);
  if (notice === false) return (await toJson([saved!]))[0]!;

  const [item] = c?.proposalId
    ? await db.select({ title: offering.title }).from(proposal).innerJoin(offering, eq(offering.id, proposal.offeringId)).where(eq(proposal.id, c.proposalId))
    : [];
  const [author] = authorId ? await db.select().from(member).where(eq(member.id, authorId)) : [];
  const others = await db
    .select({ memberId: conversationParticipant.memberId })
    .from(conversationParticipant)
    .where(and(eq(conversationParticipant.conversationId, conversationId), authorId ? ne(conversationParticipant.memberId, authorId) : undefined));
  const url = c?.proposalId ? `/proposals/${c.proposalId}` : `/reports/${c?.problemReportId}`;
  for (const { memberId } of others) {
    if (isConnected(memberId, conversationId)) continue;
    if (notice?.to && !notice.to.includes(memberId)) continue;
    await notify(memberId, 'message', {
      title: notice?.title ?? (author ? `New message from ${author.displayName}${item ? ` about ${item.title}` : ''}` : 'A new note in a conversation'),
      body: notice?.body ?? preview(saved!),
      url,
      conversationId
    });
  }
  return (await toJson([saved!]))[0]!;
}

function preview(row: MessageRow): string {
  if (row.kind === 'call_accepted') return 'Accepted a time to call';
  if (row.body) return row.body.length > 100 ? `${row.body.slice(0, 99)}…` : row.body;
  if (row.kind === 'text' && row.proposedTime) return 'Suggested a time to call';
  if (row.sharedPhone || row.sharedEmail) return 'Shared contact details';
  return row.body;
}

/** Which call proposals already have an acceptance for the same time later in the conversation. */
async function acceptedProposals(rows: MessageRow[]) {
  const proposals = rows.filter((r) => r.kind === 'text' && r.proposedTime);
  if (proposals.length === 0) return new Set<string>();
  const acceptances = await db
    .select({ conversationId: message.conversationId, proposedTime: message.proposedTime, createdAt: message.createdAt })
    .from(message)
    .where(and(eq(message.kind, 'call_accepted'), inArray(message.conversationId, [...new Set(proposals.map((p) => p.conversationId))])));
  return new Set(
    proposals
      .filter((p) => acceptances.some((a) => a.conversationId === p.conversationId && a.proposedTime?.getTime() === p.proposedTime!.getTime() && a.createdAt >= p.createdAt))
      .map((p) => p.id)
  );
}

async function toJson(rows: MessageRow[]) {
  const authorIds = [...new Set(rows.map((r) => r.authorId).filter((id): id is string => Boolean(id)))];
  const authors = authorIds.length ? await db.select().from(member).where(inArray(member.id, authorIds)) : [];
  const byId = new Map(authors.map((a) => [a.id, a]));
  const accepted = await acceptedProposals(rows);
  return rows.map((row) => {
    const author = row.authorId ? byId.get(row.authorId) : undefined;
    return {
      id: row.id,
      conversationId: row.conversationId,
      kind: row.kind,
      body: row.body,
      contact: row.sharedPhone || row.sharedEmail ? { phone: row.sharedPhone, email: row.sharedEmail } : null,
      proposedTime: row.proposedTime?.toISOString() ?? null,
      accepted: accepted.has(row.id),
      createdAt: row.createdAt.toISOString(),
      author: author ? { id: author.id, displayName: shownName(author) } : null
    };
  });
}
