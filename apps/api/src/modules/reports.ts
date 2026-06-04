// Asking for help with an agreement (FR-027 to FR-029b; data-model.md "problem_report").
//
// Help comes from the invite chain, in a shared conversation:
// 1. Reporting adds the reported member's nearest active inviter as a mediator.
// 2. The first escalation adds that mediator's own nearest active inviter, or goes straight to the
//    founders if that would be a founder or nobody.
// 3. The next escalation adds all active founders. That is the last step.
// People already in the conversation are skipped, so no one mediates their own report.
// A report may stay open indefinitely. Nothing here changes anyone's membership or access.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { agreement, conversation, conversationParticipant, listing, member, problemReport } from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { notify } from '../notify/index.ts';
import { setMediatorCheck, setReportsLookup } from './agreements.ts';
import { postSystemMessage, sendMessage } from './messaging.ts';
import { shownName } from './members.ts';

type ReportRow = typeof problemReport.$inferSelect;
type MemberRow = typeof member.$inferSelect;

/**
 * Walks up the invite chain from `memberId` and returns the first active (not deleted) inviter
 * who isn't in `skip`, or null at the top of the chain.
 */
export async function nearestActiveInviter(memberId: string, skip: Set<string> = new Set()): Promise<MemberRow | null> {
  let [current] = await db.select().from(member).where(eq(member.id, memberId));
  for (let depth = 0; current?.invitedById && depth < 1000; depth += 1) {
    const [inviter] = await db.select().from(member).where(eq(member.id, current.invitedById));
    if (!inviter) return null;
    if (!inviter.deletedAt && !skip.has(inviter.id)) return inviter;
    current = inviter;
  }
  return null;
}

async function activeFounders() {
  return db.select().from(member).where(and(eq(member.isFounder, true), isNull(member.deletedAt)));
}

export async function createReport(agreementId: string, reporterId: string, description: string) {
  const [deal] = await db.select().from(agreement).where(eq(agreement.id, agreementId));
  if (!deal || (deal.ownerId !== reporterId && deal.otherMemberId !== reporterId)) throw errors.notFound('That agreement');
  const reportedId = deal.ownerId === reporterId ? deal.otherMemberId : deal.ownerId;
  const [open] = await db
    .select({ id: problemReport.id })
    .from(problemReport)
    .where(and(eq(problemReport.agreementId, agreementId), eq(problemReport.status, 'open')));
  if (open) throw new ApiError(409, 'already_open', 'Someone has already asked for help with this agreement. You can join that conversation.');

  const parties = new Set([reporterId, reportedId]);
  const inviter = await nearestActiveInviter(reportedId, parties);
  // Nobody up the chain (e.g., the reported member is a founder): the founders help directly.
  const mediators = inviter ? [inviter] : (await activeFounders()).filter((f) => !parties.has(f.id));
  const level = inviter ? 'inviter' : 'founders';

  const { report, conversationId } = await db.transaction(async (tx) => {
    const [report] = await tx.insert(problemReport).values({ agreementId, reporterId, reportedMemberId: reportedId, description, escalationLevel: level }).returning();
    const [room] = await tx.insert(conversation).values({ listingId: deal.listingId, problemReportId: report!.id }).returning();
    const people = [reporterId, reportedId, ...mediators.map((m) => m.id)];
    await tx.insert(conversationParticipant).values([...new Set(people)].map((memberId) => ({ conversationId: room!.id, memberId })));
    return { report: report!, conversationId: room!.id };
  });

  const [reporter] = await db.select().from(member).where(eq(member.id, reporterId));
  const [reported] = await db.select().from(member).where(eq(member.id, reportedId));
  const [item] = await db.select({ title: listing.title }).from(listing).where(eq(listing.id, deal.listingId));
  const helpers = mediators.map((m) => m.displayName).join(', ');
  await postSystemMessage(
    conversationId,
    `${reporter?.displayName} asked for help with an agreement about ${item?.title}. ` +
      (inviter
        ? `${helpers}, who invited ${reported?.displayName} (or is next in their invite chain), has been added to help.`
        : `The founding members (${helpers || 'none yet'}) have been added to help.`) +
      ' This is a space to talk it through. Nobody is removed or penalised, and a request can stay open as long as needed.'
  );
  // The reporter's own words open the conversation.
  await sendMessage(conversationId, reporterId, description);
  await notifyHelpers(report.id, [reportedId, ...mediators.map((m) => m.id)]);
  return getReport(report.id, reporterId);
}

export async function escalate(reportId: string, memberId: string) {
  const report = await loadReport(reportId);
  const { participants, mediatorIds } = await peopleIn(report);
  if (memberId !== report.reporterId && !mediatorIds.includes(memberId)) {
    throw new ApiError(403, 'not_allowed', 'Only the person who asked for help, or someone helping, can ask for more help.');
  }
  if (report.status === 'resolved') throw new ApiError(409, 'resolved', 'This request for help is already settled.');
  if (report.escalationLevel === 'founders') throw new ApiError(409, 'already_at_founders', 'The founding members are already helping. This is the last step.');

  let next: { level: ReportRow['escalationLevel']; added: MemberRow[] };
  const inChat = new Set(participants);
  if (report.escalationLevel === 'inviter') {
    const currentMediator = mediatorIds[0] ?? report.reportedMemberId;
    const up = await nearestActiveInviter(currentMediator, inChat);
    next = up && !up.isFounder ? { level: 'inviters_inviter', added: [up] } : { level: 'founders', added: await activeFounders() };
  } else {
    next = { level: 'founders', added: await activeFounders() };
  }
  const added = next.added.filter((m) => !inChat.has(m.id));

  const conversationId = await conversationOf(report.id);
  await db.transaction(async (tx) => {
    await tx.update(problemReport).set({ escalationLevel: next.level }).where(eq(problemReport.id, reportId));
    if (added.length) await tx.insert(conversationParticipant).values(added.map((m) => ({ conversationId, memberId: m.id })));
  });
  await postSystemMessage(
    conversationId,
    next.level === 'founders'
      ? `The founding members have joined to help. This is the last step; the request can stay open as long as needed.`
      : `${added.map((m) => m.displayName).join(', ')} has joined to help.`
  );
  await notifyHelpers(reportId, added.map((m) => m.id));
  return getReport(reportId, memberId);
}

export async function resolve(reportId: string, memberId: string, outcomeNote: string) {
  const report = await loadReport(reportId);
  const { mediatorIds } = await peopleIn(report);
  if (memberId !== report.reporterId && !mediatorIds.includes(memberId)) {
    throw new ApiError(403, 'not_allowed', 'Only the person who asked for help, or someone helping, can mark it settled.');
  }
  if (report.status === 'resolved') throw new ApiError(409, 'resolved', 'This request for help is already settled.');
  await db.update(problemReport).set({ status: 'resolved', outcomeNote, resolvedById: memberId }).where(eq(problemReport.id, reportId));
  const [by] = await db.select().from(member).where(eq(member.id, memberId));
  await postSystemMessage(await conversationOf(reportId), `${by?.displayName} marked this as settled: ${outcomeNote}`);
  return getReport(reportId, memberId);
}

/** The reporter, the reported member, and everyone helping can see a report. */
export async function getReport(reportId: string, memberId: string) {
  const report = await loadReport(reportId);
  const { participants, mediatorIds } = await peopleIn(report);
  if (!participants.includes(memberId)) throw errors.notFound('That request for help');
  const people = await db.select().from(member).where(inArray(member.id, participants));
  const ref = (id: string) => {
    const person = people.find((p) => p.id === id)!;
    return { id: person.id, displayName: shownName(person) };
  };
  const [deal] = await db.select().from(agreement).where(eq(agreement.id, report.agreementId));
  const [item] = await db.select({ title: listing.title }).from(listing).where(eq(listing.id, deal!.listingId));
  const mayAct = memberId === report.reporterId || mediatorIds.includes(memberId);
  return {
    id: report.id,
    agreementId: report.agreementId,
    listingTitle: item?.title ?? '',
    description: report.description,
    status: report.status,
    escalationLevel: report.escalationLevel,
    outcomeNote: report.outcomeNote,
    reporter: ref(report.reporterId),
    reportedMember: ref(report.reportedMemberId),
    mediators: mediatorIds.map(ref),
    conversationId: await conversationOf(report.id),
    canEscalate: mayAct && report.status === 'open' && report.escalationLevel !== 'founders',
    canResolve: mayAct && report.status === 'open',
    createdAt: report.createdAt.toISOString()
  };
}

/** Reports on an agreement, for the agreement page (outcome notes are kept with it, FR-029). */
export async function reportsFor(agreementId: string) {
  const rows = await db.select().from(problemReport).where(eq(problemReport.agreementId, agreementId));
  return rows.map((r) => ({ id: r.id, status: r.status, outcomeNote: r.outcomeNote }));
}

setReportsLookup(reportsFor);

// Mediators may read the agreement they're helping with (FR-028).
setMediatorCheck(async (agreementId, memberId) => {
  const rows = await db
    .select({ id: conversationParticipant.id })
    .from(problemReport)
    .innerJoin(conversation, eq(conversation.problemReportId, problemReport.id))
    .innerJoin(conversationParticipant, eq(conversationParticipant.conversationId, conversation.id))
    .where(and(eq(problemReport.agreementId, agreementId), eq(conversationParticipant.memberId, memberId)))
    .limit(1);
  return rows.length > 0;
});

async function loadReport(reportId: string) {
  const [report] = await db.select().from(problemReport).where(eq(problemReport.id, reportId));
  if (!report) throw errors.notFound('That request for help');
  return report;
}

async function conversationOf(reportId: string) {
  const [room] = await db.select({ id: conversation.id }).from(conversation).where(eq(conversation.problemReportId, reportId));
  return room!.id;
}

/** Mediators are the conversation's participants other than the two parties (data-model.md). */
async function peopleIn(report: ReportRow) {
  const rows = await db
    .select({ memberId: conversationParticipant.memberId })
    .from(conversationParticipant)
    .innerJoin(conversation, eq(conversation.id, conversationParticipant.conversationId))
    .where(eq(conversation.problemReportId, report.id));
  const participants = rows.map((r) => r.memberId);
  return { participants, mediatorIds: participants.filter((id) => id !== report.reporterId && id !== report.reportedMemberId) };
}

async function notifyHelpers(reportId: string, memberIds: string[]) {
  for (const memberId of memberIds) {
    await notify(memberId, 'report', {
      title: 'Someone asked for help with an agreement',
      body: 'You can talk it over together in wunan. There is no rush.',
      url: `/reports/${reportId}`
    });
  }
}

