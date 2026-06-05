// A member's own data as a ZIP they can open without wunan (FR-032, contracts/export-format.md).
// Other members appear by display name only: never their email or private contact details,
// except details they chose to share in a conversation with this member.
import { strToU8, zipSync, type Zippable } from 'fflate';
import { asc, eq, inArray, or } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  agreement,
  conversation,
  conversationParticipant,
  listing,
  listingFlag,
  listingPhoto,
  member,
  message,
  problemReport
} from '../db/schema/index.ts';
import { decryptOptional } from '../lib/crypto.ts';
import { errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { listMyInvitations } from './invitations.ts';
import { trimDecimal } from './listings.ts';
import { shownName } from './members.ts';
import { readPhoto } from './photos.ts';
import { getPreferences } from './settings.ts';

const README = `Your wunan data
===============

This folder holds everything wunan keeps about you, so you can read it, keep it, or take it
elsewhere. Other members appear by their display name only.

my-wunan-data.json
  All of your data in one file. It opens in any text editor. Dates are written like
  2026-06-03T09:00:00Z (year, month, day, then the time in UTC).

  profile                   Your name, email, bio, when you joined, who invited you, and the
                            private contact details you saved (only ever shared when you chose to).
  invitations               Invitation links you made and who used them.
  listings                  Everything you listed, with amounts, loan lengths and what you wanted.
  agreements                Agreements you recorded or that were recorded with you.
  problem_reports           Requests for help you made, were part of, or helped with.
  conversations             Your conversations and every message in them.
  flags_sent                Requests you sent about other members' listings.
  flags_received            Requests other members sent about your listings.
  notification_preferences  Which notifications you turned on, by email and on your devices.

photos/
  The photos from your listings. Each file is named after its listing's id and its position,
  so photos/<listing id>-1.webp is that listing's first photo.
`;

type Names = Map<string, string>;

async function namesFor(ids: Iterable<string | null>): Promise<Names> {
  const wanted = [...new Set([...ids].filter((id): id is string => id !== null))];
  if (wanted.length === 0) return new Map();
  const rows = await db
    .select({ id: member.id, displayName: member.displayName, deletedAt: member.deletedAt })
    .from(member)
    .where(inArray(member.id, wanted));
  return new Map(rows.map((row) => [row.id, shownName(row)]));
}

const iso = (date: Date | null) => (date ? date.toISOString() : null);

export async function buildExport(memberId: string) {
  // Each export reads every photo; this keeps one member from tying up the server.
  await checkRateLimit(`export:${memberId}`, 10, 60);
  const [me] = await db.select().from(member).where(eq(member.id, memberId));
  if (!me) throw errors.notSignedIn();

  const listings = await db.select().from(listing).where(eq(listing.ownerId, memberId)).orderBy(asc(listing.createdAt));
  const listingIds = listings.map((l) => l.id);
  const photos = listingIds.length
    ? await db.select().from(listingPhoto).where(inArray(listingPhoto.listingId, listingIds)).orderBy(asc(listingPhoto.position), asc(listingPhoto.createdAt))
    : [];

  const agreements = await db
    .select({ agreement, listingTitle: listing.title })
    .from(agreement)
    .innerJoin(listing, eq(listing.id, agreement.listingId))
    .where(or(eq(agreement.ownerId, memberId), eq(agreement.otherMemberId, memberId)))
    .orderBy(asc(agreement.createdAt));

  // Conversations I take part in, including ones where I help as a mediator.
  const myConversations = await db
    .select({ conversation, listingTitle: listing.title })
    .from(conversationParticipant)
    .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
    .leftJoin(listing, eq(listing.id, conversation.listingId))
    .where(eq(conversationParticipant.memberId, memberId))
    .orderBy(asc(conversation.createdAt));
  const conversationIds = myConversations.map((c) => c.conversation.id);
  const participants = conversationIds.length
    ? await db.select().from(conversationParticipant).where(inArray(conversationParticipant.conversationId, conversationIds))
    : [];
  const messages = conversationIds.length
    ? await db.select().from(message).where(inArray(message.conversationId, conversationIds)).orderBy(asc(message.createdAt))
    : [];

  const mediatedReportIds = myConversations
    .map((c) => c.conversation.problemReportId)
    .filter((id): id is string => id !== null);
  const reports = await db
    .select({ report: problemReport, listingTitle: listing.title, agreementCreatedAt: agreement.createdAt })
    .from(problemReport)
    .innerJoin(agreement, eq(agreement.id, problemReport.agreementId))
    .innerJoin(listing, eq(listing.id, agreement.listingId))
    .where(
      or(
        eq(problemReport.reporterId, memberId),
        eq(problemReport.reportedMemberId, memberId),
        mediatedReportIds.length ? inArray(problemReport.id, mediatedReportIds) : undefined
      )
    )
    .orderBy(asc(problemReport.createdAt));

  const flagsSent = await db
    .select({ flag: listingFlag, listingTitle: listing.title })
    .from(listingFlag)
    .innerJoin(listing, eq(listing.id, listingFlag.listingId))
    .where(eq(listingFlag.flaggedById, memberId))
    .orderBy(asc(listingFlag.createdAt));
  const flagsReceived = listingIds.length
    ? await db
        .select({ flag: listingFlag, listingTitle: listing.title })
        .from(listingFlag)
        .innerJoin(listing, eq(listing.id, listingFlag.listingId))
        .where(inArray(listingFlag.listingId, listingIds))
        .orderBy(asc(listingFlag.createdAt))
    : [];

  const names = await namesFor([
    me.invitedById,
    ...agreements.flatMap((a) => [a.agreement.ownerId, a.agreement.otherMemberId]),
    ...participants.map((p) => p.memberId),
    ...messages.map((m) => m.authorId),
    ...flagsReceived.map((f) => f.flag.flaggedById)
  ]);
  const name = (id: string | null) => (id ? (names.get(id) ?? 'A former member') : 'wunan');

  // Photo files go in the ZIP; the JSON points at them by path.
  const files: Zippable = {};
  const photoPaths = new Map<string, string[]>();
  for (const l of listings) {
    const own = photos.filter((p) => p.listingId === l.id);
    const paths: string[] = [];
    for (const [index, photo] of own.entries()) {
      const path = `photos/${l.id}-${index + 1}.webp`;
      try {
        // Photos are already compressed, so they are stored as they are.
        files[path] = [new Uint8Array(await readPhoto(photo.fileKey)), { level: 0 }];
        paths.push(path);
      } catch {
        // A missing file is left out rather than stopping the whole export.
      }
    }
    photoPaths.set(l.id, paths);
  }

  const data = {
    format_version: 1,
    exported_at: new Date().toISOString(),
    profile: {
      display_name: me.displayName,
      email: me.email,
      bio: me.bio ?? '',
      joined: me.createdAt.toISOString(),
      invited_by: me.invitedById ? name(me.invitedById) : null,
      is_founder: me.isFounder,
      share_phone: decryptOptional(me.sharePhone) ?? '',
      share_email: decryptOptional(me.shareEmail) ?? ''
    },
    invitations: (await listMyInvitations(memberId)).map((inv) => ({
      created: inv.createdAt,
      status: inv.status,
      used_by: inv.usedBy?.displayName ?? null
    })),
    listings: listings.map((l) => ({
      id: l.id,
      type: l.type,
      title: l.title,
      description: l.description ?? '',
      amount: trimDecimal(l.amount),
      unit: l.unit,
      remaining: trimDecimal(l.remaining),
      loan_length: l.loanLength,
      loan_length_unit: l.loanLengthUnit,
      wanted: l.wanted,
      wanted_amount: trimDecimal(l.wantedAmount),
      wanted_unit: l.wantedUnit,
      open_to_offers: l.openToOffers,
      session_length: l.sessionLength,
      session_length_unit: l.sessionLengthUnit,
      sessions_available: l.sessionsAvailable,
      sessions_remaining: l.sessionsRemaining,
      area: l.area ?? '',
      status: l.status,
      created: l.createdAt.toISOString(),
      photos: photoPaths.get(l.id) ?? []
    })),
    agreements: agreements.map(({ agreement: a, listingTitle }) => {
      const role = a.ownerId === memberId ? 'owner' : 'other';
      return {
        listing_title: listingTitle,
        role,
        other_member: name(role === 'owner' ? a.otherMemberId : a.ownerId),
        outcome: a.outcome,
        amount: trimDecimal(a.amount),
        sessions: a.sessions,
        return_due: a.returnDue,
        returned_at: iso(a.returnedAt),
        confirmation: a.confirmation,
        note: a.note ?? '',
        recorded: a.createdAt.toISOString()
      };
    }),
    problem_reports: reports.map(({ report: r, listingTitle, agreementCreatedAt }) => ({
      agreement: `${listingTitle} (recorded ${agreementCreatedAt.toISOString().slice(0, 10)})`,
      role: r.reporterId === memberId ? 'reporter' : r.reportedMemberId === memberId ? 'reported' : 'mediator',
      status: r.status,
      description: r.description,
      outcome_note: r.outcomeNote ?? '',
      created: r.createdAt.toISOString()
    })),
    conversations: myConversations.map(({ conversation: c, listingTitle }) => ({
      with: participants
        .filter((p) => p.conversationId === c.id && p.memberId !== memberId)
        .map((p) => name(p.memberId)),
      listing_title: listingTitle,
      asking_for_help: c.problemReportId !== null,
      messages: messages
        .filter((m) => m.conversationId === c.id)
        .map((m) => ({
          from: m.authorId === memberId ? 'me' : name(m.authorId),
          sent: m.createdAt.toISOString(),
          kind: m.kind,
          body: m.body,
          ...(m.proposedTime ? { proposed_time: m.proposedTime.toISOString() } : {})
        }))
    })),
    flags_sent: flagsSent.map(({ flag, listingTitle }) => ({
      listing_title: listingTitle,
      request: flag.request,
      sent: flag.createdAt.toISOString()
    })),
    flags_received: flagsReceived.map(({ flag, listingTitle }) => ({
      listing_title: listingTitle,
      from: name(flag.flaggedById),
      request: flag.request,
      sent: flag.createdAt.toISOString()
    })),
    notification_preferences: await getPreferences(memberId)
  };

  files['my-wunan-data.json'] = strToU8(`${JSON.stringify(data, null, 2)}\n`);
  files['README.txt'] = strToU8(README);
  const zip = zipSync(files, { level: 6, mtime: new Date() });
  return { zip, filename: `wunan-export-${new Date().toISOString().slice(0, 10)}.zip` };
}
