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
  proposal,
  offering,
  flag,
  offeringPhoto,
  member,
  message,
  problemReport,
  publicMessage,
  request,
  requestAvailability,
  requestGiveBack,
  requestLink
} from '../db/schema/index.ts';
import { decryptOptional } from '../lib/crypto.ts';
import { errors } from '../lib/errors.ts';
import { checkRateLimit } from '../lib/rate-limit.ts';
import { listMyInvitations } from './invitations.ts';
import { trimDecimal } from './offerings.ts';
import { shownName } from './members.ts';
import { readPhoto } from './photos.ts';
import { messagesBy } from './public-messages.ts';
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
  offerings                  Everything you listed: amounts, loan lengths, how the handover happens,
                            what a trade accepts, and when a service is offered.
  proposals                 Proposals you made or received, their details, and every message.
  requests                  What you asked for, its details, and the offerings linked to it.
  public_messages           The public messages you wrote on requests and offerings.
  agreements                Agreements made when a proposal was accepted.
  problem_reports           Requests for help you made, were part of, or helped with.
  conversations             The conversations of those requests for help, and every message.
  flags_sent                Requests you sent about other members' offerings, requests, or messages.
  flags_received            Requests other members sent about your offerings, requests, or messages.
  notification_preferences  Which notifications you turned on, by email and on your devices.

photos/
  The photos from your offerings. Each file is named after its offering's id and its position,
  so photos/<offering id>-1.webp is that offering's first photo.
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

  const offerings = await db.select().from(offering).where(eq(offering.ownerId, memberId)).orderBy(asc(offering.createdAt));
  const offeringIds = offerings.map((l) => l.id);
  const photos = offeringIds.length
    ? await db.select().from(offeringPhoto).where(inArray(offeringPhoto.offeringId, offeringIds)).orderBy(asc(offeringPhoto.position), asc(offeringPhoto.createdAt))
    : [];

  const agreements = await db
    .select({ agreement, offeringTitle: offering.title })
    .from(agreement)
    .innerJoin(offering, eq(offering.id, agreement.offeringId))
    .where(or(eq(agreement.ownerId, memberId), eq(agreement.otherMemberId, memberId)))
    .orderBy(asc(agreement.createdAt));

  // Conversations I take part in, including ones where I help as a mediator.
  const myConversations = await db
    .select({ conversation, offeringTitle: offering.title })
    .from(conversationParticipant)
    .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
    .leftJoin(proposal, eq(proposal.id, conversation.proposalId))
    .leftJoin(offering, eq(offering.id, proposal.offeringId))
    .where(eq(conversationParticipant.memberId, memberId))
    .orderBy(asc(conversation.createdAt));
  const conversationIds = myConversations.map((c) => c.conversation.id);
  const participants = conversationIds.length
    ? await db.select().from(conversationParticipant).where(inArray(conversationParticipant.conversationId, conversationIds))
    : [];
  const messages = conversationIds.length
    ? await db.select().from(message).where(inArray(message.conversationId, conversationIds)).orderBy(asc(message.createdAt))
    : [];

  // Proposals I made or received (002 FR-033).
  const myProposals = await db
    .select({ proposal, offeringTitle: offering.title, offeringType: offering.type, ownerId: offering.ownerId })
    .from(proposal)
    .innerJoin(offering, eq(offering.id, proposal.offeringId))
    .where(or(eq(proposal.requesterId, memberId), eq(offering.ownerId, memberId)))
    .orderBy(asc(proposal.createdAt));
  const threadOfProposal = new Map(myConversations.filter((c) => c.conversation.proposalId).map((c) => [c.conversation.proposalId!, c.conversation.id]));

  const mediatedReportIds = myConversations
    .map((c) => c.conversation.problemReportId)
    .filter((id): id is string => id !== null);
  const reports = await db
    .select({ report: problemReport, offeringTitle: offering.title, agreementCreatedAt: agreement.createdAt })
    .from(problemReport)
    .innerJoin(agreement, eq(agreement.id, problemReport.agreementId))
    .innerJoin(offering, eq(offering.id, agreement.offeringId))
    .where(
      or(
        eq(problemReport.reporterId, memberId),
        eq(problemReport.reportedMemberId, memberId),
        mediatedReportIds.length ? inArray(problemReport.id, mediatedReportIds) : undefined
      )
    )
    .orderBy(asc(problemReport.createdAt));

  // My requests (003 FR-026), with what a trade asker could give back, times, and links.
  const myRequests = await db.select().from(request).where(eq(request.askerId, memberId)).orderBy(asc(request.createdAt));
  const requestIds = myRequests.map((r) => r.id);
  const [giveBack, requestTimes, requestLinks] = requestIds.length
    ? await Promise.all([
        db.select().from(requestGiveBack).where(inArray(requestGiveBack.requestId, requestIds)).orderBy(asc(requestGiveBack.position)),
        db.select().from(requestAvailability).where(inArray(requestAvailability.requestId, requestIds)),
        db
          .select({ link: requestLink, offeringTitle: offering.title })
          .from(requestLink)
          .innerJoin(offering, eq(offering.id, requestLink.offeringId))
          .where(inArray(requestLink.requestId, requestIds))
      ])
    : [[], [], []];
  const myMessageIds = (await db.select({ id: publicMessage.id }).from(publicMessage).where(eq(publicMessage.authorId, memberId))).map((m) => m.id);

  // Flags on offerings, requests, and public messages: what each was about, in words.
  const flagSubject = { offeringTitle: offering.title, requestTitle: request.title, messageBody: publicMessage.body };
  const flagsSent = await db
    .select({ flag, ...flagSubject })
    .from(flag)
    .leftJoin(offering, eq(offering.id, flag.offeringId))
    .leftJoin(request, eq(request.id, flag.requestId))
    .leftJoin(publicMessage, eq(publicMessage.id, flag.publicMessageId))
    .where(eq(flag.flaggedById, memberId))
    .orderBy(asc(flag.createdAt));
  const mineReceived = [
    offeringIds.length ? inArray(flag.offeringId, offeringIds) : undefined,
    requestIds.length ? inArray(flag.requestId, requestIds) : undefined,
    myMessageIds.length ? inArray(flag.publicMessageId, myMessageIds) : undefined
  ].filter((c) => c !== undefined);
  const flagsReceived = mineReceived.length
    ? await db
        .select({ flag, ...flagSubject })
        .from(flag)
        .leftJoin(offering, eq(offering.id, flag.offeringId))
        .leftJoin(request, eq(request.id, flag.requestId))
        .leftJoin(publicMessage, eq(publicMessage.id, flag.publicMessageId))
        .where(or(...mineReceived))
        .orderBy(asc(flag.createdAt))
    : [];
  const about = (f: { offeringTitle: string | null; requestTitle: string | null; messageBody: string | null }) =>
    f.offeringTitle ? { offering_title: f.offeringTitle } : f.requestTitle ? { request_title: f.requestTitle } : { public_message: f.messageBody ?? '' };

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
  for (const l of offerings) {
    const own = photos.filter((p) => p.offeringId === l.id);
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
    offerings: offerings.map((l) => ({
      id: l.id,
      type: l.type,
      title: l.title,
      description: l.description ?? '',
      amount: trimDecimal(l.amount),
      unit: l.unit,
      remaining: trimDecimal(l.remaining),
      loan_length: l.loanLength,
      loan_length_unit: l.loanLengthUnit,
      handovers: l.handovers,
      meeting_place: l.meetingPlace?.label ?? '',
      session_length: l.sessionLength,
      session_length_unit: l.sessionLengthUnit,
      sessions_available: l.sessionsAvailable,
      sessions_remaining: l.sessionsRemaining,
      area: l.area?.label ?? '',
      status: l.status,
      created: l.createdAt.toISOString(),
      photos: photoPaths.get(l.id) ?? []
    })),
    agreements: agreements.map(({ agreement: a, offeringTitle }) => {
      const role = a.ownerId === memberId ? 'owner' : 'other';
      return {
        offering_title: offeringTitle,
        role,
        other_member: name(role === 'owner' ? a.otherMemberId : a.ownerId),
        outcome: a.outcome,
        amount: trimDecimal(a.amount),
        sessions: a.sessions,
        when: iso(a.startsAt),
        handover: a.handover,
        place: a.place?.label ?? '',
        offer: a.offer,
        loan_starts_at: iso(a.loanStartsAt),
        loan_ends_at: iso(a.loanEndsAt),
        returned_at: iso(a.returnedAt),
        recorded: a.createdAt.toISOString()
      };
    }),
    problem_reports: reports.map(({ report: r, offeringTitle, agreementCreatedAt }) => ({
      agreement: `${offeringTitle} (recorded ${agreementCreatedAt.toISOString().slice(0, 10)})`,
      role: r.reporterId === memberId ? 'reporter' : r.reportedMemberId === memberId ? 'reported' : 'mediator',
      status: r.status,
      description: r.description,
      outcome_note: r.outcomeNote ?? '',
      created: r.createdAt.toISOString()
    })),
    proposals: myProposals.map(({ proposal: p, offeringTitle, ownerId }) => ({
      offering_title: offeringTitle,
      role: p.requesterId === memberId ? 'requester' : 'lister',
      with: name(p.requesterId === memberId ? ownerId : p.requesterId),
      status: p.status,
      closed_reason: p.closedReason,
      when: iso(p.startsAt),
      has_time: p.hasTime,
      handover: p.handover,
      place: p.place?.label ?? '',
      loan_length: p.loanLength,
      loan_length_unit: p.loanLengthUnit,
      amount: trimDecimal(p.amount),
      own_offer: p.ownOffer,
      session_length: p.sessionLength,
      session_length_unit: p.sessionLengthUnit,
      sessions: p.sessions,
      decision_note: p.decisionNote,
      created: p.createdAt.toISOString(),
      messages: messages
        .filter((m) => m.conversationId === threadOfProposal.get(p.id))
        .map((m) => ({ from: m.authorId === memberId ? 'me' : name(m.authorId), sent: m.createdAt.toISOString(), kind: m.kind, body: m.body }))
    })),
    conversations: myConversations.filter(({ conversation: c }) => c.problemReportId !== null).map(({ conversation: c, offeringTitle }) => ({
      with: participants
        .filter((p) => p.conversationId === c.id && p.memberId !== memberId)
        .map((p) => name(p.memberId)),
      offering_title: offeringTitle,
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
    requests: myRequests.map((r) => ({
      kind: r.kind,
      title: r.title,
      description: r.description,
      needed_after: r.neededAfter,
      needed_by: r.neededBy,
      area: r.area?.label ?? '',
      handovers: r.handovers,
      loan_length: r.loanLength,
      loan_length_unit: r.loanLengthUnit,
      amount: trimDecimal(r.amount),
      unit: r.unit,
      could_give_back: giveBack.filter((g) => g.requestId === r.id).map((g) => ({ description: g.description, amount: trimDecimal(g.amount), unit: g.unit })),
      session_length: r.sessionLength,
      session_length_unit: r.sessionLengthUnit,
      sessions: r.sessions,
      times_that_suit: requestTimes.filter((t) => t.requestId === r.id).map((t) => ({ weekday: t.weekday, from: t.startTime.slice(0, 5), to: t.endTime.slice(0, 5) })),
      status: r.status,
      closed_reason: r.closedReason,
      linked_offerings: requestLinks.filter((l) => l.link.requestId === r.id).map((l) => ({ offering_id: l.link.offeringId, title: l.offeringTitle })),
      created: r.createdAt.toISOString()
    })),
    public_messages: await messagesBy(memberId),
    flags_sent: flagsSent.map((f) => ({
      ...about(f),
      request: f.flag.request,
      sent: f.flag.createdAt.toISOString()
    })),
    flags_received: flagsReceived.map((f) => ({
      ...about(f),
      from: name(f.flag.flaggedById),
      request: f.flag.request,
      sent: f.flag.createdAt.toISOString()
    })),
    notification_preferences: await getPreferences(memberId)
  };

  files['my-wunan-data.json'] = strToU8(`${JSON.stringify(data, null, 2)}\n`);
  files['README.txt'] = strToU8(README);
  const zip = zipSync(files, { level: 6, mtime: new Date() });
  return { zip, filename: `wunan-export-${new Date().toISOString().slice(0, 10)}.zip` };
}
