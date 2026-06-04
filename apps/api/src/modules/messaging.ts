// Conversations and messages (FR-018 to FR-020): starting a conversation, listing them with unread
// state, sending, sharing chosen contact details, and agreeing a call time. Only participants can
// read or write a conversation; anyone else gets "not found".
import { and, desc, eq, gt, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { conversation, conversationParticipant, listing, member, message } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { notify } from '../notify/index.ts';
import { announce, isConnected } from './live.ts';
import { getContact, shownName } from './members.ts';

type MessageRow = typeof message.$inferSelect;

/** Throws "not found" unless the member takes part in the conversation. */
export async function requireParticipant(conversationId: string, memberId: string) {
  const [row] = await db
    .select({ id: conversationParticipant.id, lastReadAt: conversationParticipant.lastReadAt })
    .from(conversationParticipant)
    .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.memberId, memberId)));
  if (!row) throw errors.notFound('That conversation');
  return row;
}

/** Finds the conversation between two members (about the same listing), or starts one. */
export async function startConversation(memberId: string, otherId: string, listingId: string | null) {
  if (memberId === otherId) throw new ApiError(400, 'cannot_message_self', "You can't start a conversation with yourself.");
  const [other] = await db.select().from(member).where(eq(member.id, otherId));
  if (!other || !other.emailVerified || other.deletedAt) throw errors.notFound('That member');
  if (listingId) {
    const [item] = await db.select({ id: listing.id }).from(listing).where(eq(listing.id, listingId));
    if (!item) throw errors.notFound('That listing');
  }

  return db.transaction(async (tx) => {
    // One conversation per pair and listing: a lock on the pair stops two being created at once.
    const pairKey = [memberId, otherId].sort().join(':') + (listingId ?? '');
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${pairKey}))`);
    const existing = await tx.execute<{ id: string }>(sql`
      select c.id from conversation c
       where c.problem_report_id is null
         and c.listing_id is not distinct from ${listingId}
         and exists (select 1 from conversation_participant p where p.conversation_id = c.id and p.member_id = ${memberId})
         and exists (select 1 from conversation_participant p where p.conversation_id = c.id and p.member_id = ${otherId})
         and (select count(*) from conversation_participant p where p.conversation_id = c.id) = 2
       limit 1`);
    if (existing[0]) return { id: existing[0].id, created: false };
    const [created] = await tx.insert(conversation).values({ listingId }).returning();
    await tx.insert(conversationParticipant).values([
      { conversationId: created!.id, memberId },
      { conversationId: created!.id, memberId: otherId }
    ]);
    return { id: created!.id, created: true };
  });
}

/** My conversations, latest first, each with who's in it, the listing, a preview, and unread state. */
export async function listConversations(memberId: string) {
  const mine = await db
    .select({ conversation, lastReadAt: conversationParticipant.lastReadAt })
    .from(conversationParticipant)
    .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
    .where(eq(conversationParticipant.memberId, memberId))
    .orderBy(desc(conversation.lastMessageAt));
  return Promise.all(mine.map(({ conversation: c, lastReadAt }) => summarise(c, memberId, lastReadAt)));
}

export async function getConversation(conversationId: string, memberId: string) {
  const { lastReadAt } = await requireParticipant(conversationId, memberId);
  const [row] = await db.select().from(conversation).where(eq(conversation.id, conversationId));
  return summarise(row!, memberId, lastReadAt);
}

async function summarise(c: typeof conversation.$inferSelect, memberId: string, lastReadAt: Date | null) {
  const people = await db
    .select({ id: member.id, displayName: member.displayName, deletedAt: member.deletedAt })
    .from(conversationParticipant)
    .innerJoin(member, eq(member.id, conversationParticipant.memberId))
    .where(and(eq(conversationParticipant.conversationId, c.id), ne(conversationParticipant.memberId, memberId)));
  const [item] = c.listingId ? await db.select({ id: listing.id, title: listing.title }).from(listing).where(eq(listing.id, c.listingId)) : [];
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
    listing: item ?? null,
    isMediation: c.problemReportId !== null,
    lastMessage: last
      ? { preview: preview(last), createdAt: last.createdAt.toISOString(), author: lastAuthor ? { id: lastAuthor.id, displayName: shownName(lastAuthor) } : null }
      : null,
    unread: Boolean(unread)
  };
}

/** Newest first, a page at a time. */
export async function listMessages(conversationId: string, memberId: string, cursor: string | undefined, limit = 50) {
  await requireParticipant(conversationId, memberId);
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

export async function sendMessage(conversationId: string, memberId: string, body: string) {
  await requireParticipant(conversationId, memberId);
  await checkRateLimit(`message:${memberId}`, 60, 60);
  return post(conversationId, memberId, { kind: 'text', body });
}

/** Posts exactly the chosen saved contact details into the conversation (FR-019). */
export async function shareContact(conversationId: string, memberId: string, choice: { phone: boolean; email: boolean }) {
  await requireParticipant(conversationId, memberId);
  const saved = await getContact(memberId);
  const missing = (what: string) =>
    new ApiError(400, 'contact_not_saved', `You haven't saved ${what} yet. Add it in Settings first.`);
  const lines: string[] = [];
  if (choice.phone) {
    if (!saved.sharePhone) throw missing('a phone number');
    lines.push(`Phone: ${saved.sharePhone}`);
  }
  if (choice.email) {
    if (!saved.shareEmail) throw missing('an email to share');
    lines.push(`Email: ${saved.shareEmail}`);
  }
  return post(conversationId, memberId, { kind: 'contact_shared', body: lines.join('\n') });
}

export async function proposeCall(conversationId: string, memberId: string, proposedTime: Date) {
  await requireParticipant(conversationId, memberId);
  if (proposedTime.getTime() < Date.now()) {
    throw new ApiError(400, 'validation_failed', 'Some details need fixing.', { proposedTime: 'Please choose a time that is still to come.' });
  }
  return post(conversationId, memberId, { kind: 'call_proposed', proposedTime });
}

/** The other person accepts a proposed time (FR-020). To suggest another time, they propose one. */
export async function acceptCall(conversationId: string, memberId: string, proposalId: string) {
  await requireParticipant(conversationId, memberId);
  const [proposal] = await db
    .select()
    .from(message)
    .where(and(eq(message.id, proposalId), eq(message.conversationId, conversationId), eq(message.kind, 'call_proposed')));
  if (!proposal) throw errors.notFound('That call time');
  if (proposal.authorId === memberId) throw new ApiError(400, 'own_proposal', 'The other person needs to accept the time you suggested.');
  if ((await acceptedProposals([proposal])).has(proposal.id)) throw new ApiError(409, 'already_accepted', 'This call time was already accepted.');
  return post(conversationId, memberId, { kind: 'call_accepted', proposedTime: proposal.proposedTime });
}

export async function markRead(conversationId: string, memberId: string) {
  await requireParticipant(conversationId, memberId);
  await db
    .update(conversationParticipant)
    .set({ lastReadAt: new Date() })
    .where(and(eq(conversationParticipant.conversationId, conversationId), eq(conversationParticipant.memberId, memberId)));
}

export async function countUnreadConversations(memberId: string) {
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

/** Saves a message, tells open streams, and notifies participants who don't have it open. */
async function post(conversationId: string, authorId: string | null, values: Pick<MessageRow, 'kind'> & Partial<Pick<MessageRow, 'body' | 'proposedTime'>>) {
  const [saved] = await db
    .insert(message)
    .values({ conversationId, authorId, kind: values.kind, body: values.body ?? '', proposedTime: values.proposedTime ?? null })
    .returning();
  await db.update(conversation).set({ lastMessageAt: saved!.createdAt }).where(eq(conversation.id, conversationId));
  await announce(conversationId, saved!.id);

  const [c] = await db.select().from(conversation).where(eq(conversation.id, conversationId));
  const [item] = c?.listingId ? await db.select({ title: listing.title }).from(listing).where(eq(listing.id, c.listingId)) : [];
  const [author] = authorId ? await db.select().from(member).where(eq(member.id, authorId)) : [];
  const others = await db
    .select({ memberId: conversationParticipant.memberId })
    .from(conversationParticipant)
    .where(and(eq(conversationParticipant.conversationId, conversationId), authorId ? ne(conversationParticipant.memberId, authorId) : undefined));
  for (const { memberId } of others) {
    if (isConnected(memberId, conversationId)) continue;
    await notify(memberId, 'message', {
      title: author ? `New message from ${author.displayName}${item ? ` about ${item.title}` : ''}` : 'A new note in a conversation',
      body: preview(saved!),
      url: `/messages/${conversationId}`,
      conversationId
    });
  }
  return (await toJson([saved!]))[0]!;
}

function preview(row: MessageRow): string {
  switch (row.kind) {
    case 'contact_shared':
      return 'Shared contact details';
    case 'call_proposed':
      return 'Suggested a time to call';
    case 'call_accepted':
      return 'Accepted a time to call';
    default:
      return row.body.length > 100 ? `${row.body.slice(0, 99)}…` : row.body;
  }
}

/** Which call proposals already have an acceptance for the same time later in the conversation. */
async function acceptedProposals(rows: MessageRow[]) {
  const proposals = rows.filter((r) => r.kind === 'call_proposed' && r.proposedTime);
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
      proposedTime: row.proposedTime?.toISOString() ?? null,
      accepted: accepted.has(row.id),
      createdAt: row.createdAt.toISOString(),
      author: author ? { id: author.id, displayName: shownName(author) } : null
    };
  });
}
