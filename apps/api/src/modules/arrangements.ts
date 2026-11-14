// Arrangements (004; rules from 002 FR-010 to FR-021 and research §3–§6): one exchange between a
// requester and an offering's owner, from the first ask to its end. While it is open every detail
// is optional and only the requester changes them; what it says is what the requester has agreed
// to. The lister accepts once nothing blocks it, which makes it agreed and fixes its details, in
// one transaction with the offering. An agreed loan is later marked returned by its owner; an
// agreed gift, trade or service can be marked as done by either member (and un-marked).
// What blocks accepting is worked out by `arrangementIssues` (arrangement-issues.ts); the stage,
// "needs me" and the timeline by arrangement-stage.ts. None of them is stored.
import type { AgreedOffer, CreateArrangement, ArrangementDetailsInput } from '@wunan/shared';
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, ne, or, sql, type SQL } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  arrangement,
  arrangementOffer,
  conversation,
  offering,
  member,
  message,
  request,
  requestLink,
  serviceAvailability,
  tradeAccept
} from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { communityTimeZone, describeWhen, instantToLocal, localToInstant } from '../lib/time.ts';
import { notify } from '../notify/index.ts';
import {
  arrangementIssues,
  handoverWords,
  length,
  loanEnd,
  placeFromOffering,
  quantity,
  resolvedPlace,
  whenWord,
  type AcceptRow,
  type ArrangementRow,
  type OfferRow,
  type OfferingContext,
  type OfferingRow
} from './arrangement-issues.ts';
import { groupOf, isOverdue, needsMe, stageOf, timelineOf, type HelpRequest, type Note } from './arrangement-stage.ts';
import { announceSettled, closeForArrangement } from './requests.ts';
import { earlierLoanNotBack, trimDecimal } from './offerings.ts';
import { setArrangementCloser, shownName } from './members.ts';
import { createThread, postEvent } from './messaging.ts';
import { viewPlace } from './places.ts';

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

// ── Loading ────────────────────────────────────────────────────────────────────────────────────

async function offeringContext(offeringId: string, tx: Transaction | typeof db = db): Promise<OfferingContext> {
  const [row] = await tx.select().from(offering).where(eq(offering.id, offeringId));
  if (!row) throw errors.notFound('That offering');
  const [owner] = await tx.select().from(member).where(eq(member.id, row.ownerId));
  const accepts = await tx.select().from(tradeAccept).where(eq(tradeAccept.offeringId, offeringId)).orderBy(asc(tradeAccept.position));
  const times = await tx.select().from(serviceAvailability).where(eq(serviceAvailability.offeringId, offeringId));
  const loans = await tx
    .select({ id: arrangement.id, offeringId: arrangement.offeringId, startsAt: arrangement.loanStartsAt, endsAt: arrangement.loanEndsAt })
    .from(arrangement)
    .where(and(eq(arrangement.offeringId, offeringId), isNotNull(arrangement.loanStartsAt), isNull(arrangement.returnedAt)))
    .orderBy(asc(arrangement.loanStartsAt));
  return { offering: row, ownerName: owner ? shownName(owner) : 'The lister', accepts, times, loans };
}

const offersOf = (arrangementId: string, tx: Transaction | typeof db = db) =>
  tx.select({ tradeAcceptId: arrangementOffer.tradeAcceptId, amount: arrangementOffer.amount }).from(arrangementOffer).where(eq(arrangementOffer.arrangementId, arrangementId));

// ── Input ──────────────────────────────────────────────────────────────────────────────────────

const typeFields = {
  lend: ['loanLength', 'loanLengthUnit'],
  gift: ['amount'],
  trade: ['amount', 'offers', 'ownOffer', 'ownOfferAmount', 'ownOfferUnit'],
  service: ['sessionLength', 'sessionLengthUnit', 'sessions']
} as const;
const commonFields = ['date', 'time', 'handover', 'place'];

const needsFixing = (fields: Record<string, string>) => new ApiError(400, 'validation_failed', 'Some details need fixing.', fields);

/**
 * Turns input into column values, keeping only what's given. Refuses details that don't apply to
 * the offering's type and half-given pairs; whether values fit the offering is left to the issues.
 */
function toValues(input: ArrangementDetailsInput, current: ArrangementRow | null, ctx: OfferingContext) {
  const l = ctx.offering;
  const allowed = new Set<string>([...commonFields, ...typeFields[l.type]]);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && !allowed.has(key)) fields[key] = "This doesn't apply to this kind of offering.";
  }
  const values: Partial<typeof arrangement.$inferInsert> = {};
  const has = (key: keyof ArrangementDetailsInput) => input[key] !== undefined;

  if (has('date') || has('time')) {
    const before = current?.startsAt ? instantToLocal(current.startsAt) : null;
    const date = has('date') ? input.date : before?.date;
    const time = has('time') ? input.time : current?.hasTime ? before?.time : null;
    if (!date && time) fields.date = 'Please choose a date for that time.';
    values.startsAt = date ? localToInstant(date, time) : null;
    values.hasTime = Boolean(date && time);
  }
  if (has('handover')) values.handover = input.handover ?? null;
  if (has('place')) values.place = input.place ?? null;
  const handover = values.handover !== undefined ? values.handover : current?.handover;
  // At the lister's, the place is the offering's area; online, there is no place.
  if (handover === 'at_lister' || handover === 'online') {
    if (has('place') && input.place) fields.place = handover === 'online' ? 'No place is needed for online.' : `This happens at ${ctx.ownerName}'s place.`;
    values.place = null;
  }
  const pair = (n: keyof ArrangementDetailsInput, u: keyof ArrangementDetailsInput, unitMessage: string) => {
    if (!has(n) && !has(u)) return;
    const number = has(n) ? input[n] : current?.[n as keyof ArrangementRow];
    const unit = has(u) ? input[u] : current?.[u as keyof ArrangementRow];
    if (number != null && unit == null) fields[u] = unitMessage;
    if (unit != null && number == null) fields[n] = 'Please add a number to go with the unit.';
  };
  pair('loanLength', 'loanLengthUnit', 'Please choose hours, days, or weeks.');
  pair('sessionLength', 'sessionLengthUnit', 'Please choose minutes, hours, days, or weeks.');
  pair('ownOfferAmount', 'ownOfferUnit', 'Please choose a unit for the amount.');
  for (const key of ['loanLength', 'loanLengthUnit', 'amount', 'ownOffer', 'ownOfferAmount', 'ownOfferUnit', 'sessionLength', 'sessionLengthUnit', 'sessions'] as const) {
    if (has(key) && allowed.has(key)) (values as Record<string, unknown>)[key] = input[key] ?? null;
  }
  if (l.type === 'trade') {
    if (ctx.accepts.length > 0 && input.ownOffer) fields.ownOffer = `Please choose from what ${ctx.ownerName} listed.`;
    if (ctx.accepts.length === 0 && input.offers?.length) fields.offers = `${ctx.ownerName} is open to offers, so please describe yours.`;
    else if ((input.offers ?? []).some((offer) => !ctx.accepts.some((a) => a.id === offer.acceptId))) fields.offers = 'Please choose from the list.';
  }
  if (Object.keys(fields).length > 0) throw needsFixing(fields);
  return values;
}

async function saveOffers(tx: Transaction, arrangementId: string, offers: ArrangementDetailsInput['offers']) {
  if (offers === undefined) return;
  await tx.delete(arrangementOffer).where(eq(arrangementOffer.arrangementId, arrangementId));
  const unique = [...new Map((offers ?? []).map((o) => [o.acceptId, o])).values()];
  if (unique.length) await tx.insert(arrangementOffer).values(unique.map((o) => ({ arrangementId, tradeAcceptId: o.acceptId, amount: o.amount ?? null })));
}

// ── Making and changing ────────────────────────────────────────────────────────────────────────

const askedWords = { lend: 'asked to borrow your', gift: 'asked for your', trade: 'offered a trade for your', service: 'asked for your' } as const;
const askedAgainWords = { lend: 'asked again to borrow your', gift: 'asked again for your', trade: 'offered a trade again for your', service: 'asked again for your' } as const;
/** The note in the conversation; the timeline's "Asked" comes from it. */
const askedNote = { lend: 'asked to borrow this', gift: 'asked for this', trade: 'offered a trade for this', service: 'asked for this' } as const;

/** Every detail empty, so asking again starts from what is asked now, not what was asked before. */
const noDetails = {
  startsAt: null,
  hasTime: false,
  handover: null,
  place: null,
  loanLength: null,
  loanLengthUnit: null,
  amount: null,
  ownOffer: null,
  ownOfferAmount: null,
  ownOfferUnit: null,
  sessionLength: null,
  sessionLengthUnit: null,
  sessions: null
} as const;

/**
 * A member asks for something on an offering. If their earlier arrangement on it ended without
 * agreement (declined, withdrawn, closed), that same arrangement is reopened with the new details,
 * keeping its id and its conversation (004 FR-010a); the database allows only one per requester
 * and offering that isn't agreed. After an agreement, asking again makes a new one.
 */
export async function createArrangement(offeringId: string, requesterId: string, input: CreateArrangement) {
  const ctx = await offeringContext(offeringId);
  const l = ctx.offering;
  if (l.ownerId === requesterId) throw new ApiError(400, 'own_offering', "This is your own offering, so you can't make a proposal on it.");
  if (l.status !== 'available') throw new ApiError(409, 'not_available', "This offering isn't available right now, so a proposal can't be made.");
  const earlier = () =>
    db
      .select({ id: arrangement.id, status: arrangement.status })
      .from(arrangement)
      .where(and(eq(arrangement.offeringId, offeringId), eq(arrangement.requesterId, requesterId), ne(arrangement.status, 'agreed')));
  const [existing] = await earlier();
  if (existing?.status === 'open') throw alreadyOpen(existing.id);

  const { message: firstMessage, requestId: chosenRequest, ...details } = input;
  const requestId = await requestTiedTo(offeringId, requesterId, chosenRequest);
  const values = toValues(details, null, ctx);
  // Gift and Trade amounts start at all that's left (FR-012, FR-013).
  if ((l.type === 'gift' || l.type === 'trade') && values.amount === undefined && l.remaining !== null) values.amount = l.remaining;

  let saved: { id: string; conversationId: string; again: boolean };
  try {
    saved = await db.transaction(async (tx) => {
      if (existing) {
        const reopened = await tx
          .update(arrangement)
          .set({ ...noDetails, ...values, requestId, status: 'open', closedReason: null, decisionNote: null, version: sql`${arrangement.version} + 1`, lastActivityAt: new Date(), updatedAt: new Date() })
          .where(and(eq(arrangement.id, existing.id), inArray(arrangement.status, ['declined', 'withdrawn', 'closed'])))
          .returning({ id: arrangement.id });
        if (reopened.length === 0) throw alreadyOpen(existing.id);
        await saveOffers(tx, existing.id, details.offers ?? []);
        return { id: existing.id, conversationId: await threadOf(existing.id), again: true };
      }
      const [row] = await tx.insert(arrangement).values({ ...values, offeringId, requesterId, requestId }).returning({ id: arrangement.id });
      await saveOffers(tx, row!.id, details.offers);
      const thread = await createThread(tx, { arrangementId: row!.id }, [requesterId, l.ownerId]);
      return { id: row!.id, conversationId: thread.id, again: false };
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Two clicks at once: the second one hits the one-per-requester index.
    const [again] = await earlier();
    if (again?.status === 'open') throw alreadyOpen(again.id);
    throw err;
  }

  const [requester] = await db.select().from(member).where(eq(member.id, requesterId));
  const name = requester?.displayName ?? 'A member';
  await postEvent(saved.conversationId, requesterId, { kind: 'asked', body: `${name} ${askedNote[l.type]}${saved.again ? ' again' : ''}.` });
  const notice = { title: `${name} ${(saved.again ? askedAgainWords : askedWords)[l.type]} ${l.title}`, body: firstMessage ?? 'Have a look at what they asked for.' };
  if (firstMessage) await postEvent(saved.conversationId, requesterId, { kind: 'text', body: firstMessage }, notice);
  else await notify(l.ownerId, 'message', { ...notice, url: `/arrangements/${saved.id}`, conversationId: saved.conversationId });
  return { id: saved.id, conversationId: saved.conversationId, reopened: saved.again };
}

/**
 * Which of the requester's open requests this arrangement answers (003 research §3): only one of their
 * own, linked to this offering. Linked to several → they must choose. Not linked → none.
 */
async function requestTiedTo(offeringId: string, requesterId: string, chosen: string | undefined) {
  const linked = await db
    .select({ id: request.id, title: request.title })
    .from(requestLink)
    .innerJoin(request, eq(request.id, requestLink.requestId))
    .where(and(eq(requestLink.offeringId, offeringId), eq(request.askerId, requesterId), eq(request.status, 'open')))
    .orderBy(asc(request.createdAt));
  if (chosen) {
    if (!linked.some((r) => r.id === chosen)) {
      throw new ApiError(400, 'not_your_request', 'That request is not one of your open requests linked to this offering.', { requestId: 'Please choose one of your requests.' });
    }
    return chosen;
  }
  if (linked.length > 1) {
    throw new ApiError(409, 'choose_request', 'This offering is linked to more than one of your requests. Please choose which one this is for.', undefined, { requests: linked });
  }
  return linked[0]?.id ?? null;
}

const alreadyOpen = (arrangementId: string) =>
  new ApiError(409, 'already_open', 'You already have a proposal open on this offering. You can change it instead.', undefined, { arrangementId });

/** The requester changes details (FR-016). Each change is noted in the thread in plain words. */
export async function updateArrangement(arrangementId: string, requesterId: string, input: ArrangementDetailsInput) {
  const current = await loadArrangement(arrangementId);
  if (current.requesterId !== requesterId) {
    const ctx = await offeringContext(current.offeringId);
    if (ctx.offering.ownerId === requesterId) throw new ApiError(403, 'not_requester', `Only the person who made the proposal can change it. You can ask them in a message.`);
    throw errors.notFound('That arrangement');
  }
  if (current.status !== 'open') throw new ApiError(409, 'arrangement_ended', 'This proposal has ended, so it can no longer be changed.');
  const ctx = await offeringContext(current.offeringId);
  const values = toValues(input, current, ctx);
  const before = await describeDetails(current, await offersOf(arrangementId), ctx);

  await db.transaction(async (tx) => {
    await tx
      .update(arrangement)
      .set({ ...values, version: sql`${arrangement.version} + 1`, updatedAt: new Date() })
      .where(eq(arrangement.id, arrangementId));
    await saveOffers(tx, arrangementId, input.offers);
  });

  const updated = await loadArrangement(arrangementId);
  const after = await describeDetails(updated, await offersOf(arrangementId), ctx);
  const changes = Object.keys(after).filter((key) => before[key] !== after[key]);
  const [requester] = await db.select().from(member).where(eq(member.id, requesterId));
  const name = requester?.displayName ?? 'The requester';
  if (changes.length > 0) {
    const words = changes.map((key) => (after[key] ? `${key} to ${after[key]}` : `cleared ${key}`));
    await postEvent(
      await threadOf(arrangementId),
      requesterId,
      { kind: 'detail_changed', body: `${name} changed ${joinWords(words)}.` },
      { title: `${name} changed what they asked for ${ctx.offering.title}`, body: 'Have a look at the new details.' }
    );
  }
  return getArrangement(arrangementId, requesterId);
}

/** Each detail as words, keyed by how it's named in "Robin changed the pickup time to …". */
async function describeDetails(p: ArrangementRow, offers: OfferRow[], ctx: OfferingContext): Promise<Record<string, string>> {
  const l = ctx.offering;
  const [requester] = await db.select().from(member).where(eq(member.id, p.requesterId));
  const names = { lister: ctx.ownerName, requester: requester ? shownName(requester) : 'the requester' };
  const d: Record<string, string> = {
    [`the ${whenWord[l.type]}`]: p.startsAt ? describeWhen(p.startsAt, p.hasTime) : '',
    'how it happens': p.handover ? handoverWords(l.type, p.handover, names).replace(/^./, (c) => c.toLowerCase()) : '',
    where: p.place ? p.place.label : ''
  };
  if (l.type === 'lend') d['how long'] = p.loanLength && p.loanLengthUnit ? length(p.loanLength, p.loanLengthUnit) : '';
  if (l.type === 'gift' || l.type === 'trade') d['how much'] = p.amount ? quantity(p.amount, l.unit) : '';
  if (l.type === 'trade') {
    d['what they offer'] = offers.length
      ? offers.map((o) => {
          const thing = ctx.accepts.find((a) => a.id === o.tradeAcceptId);
          return thing ? `${thing.description}${o.amount ? ` (${quantity(o.amount, thing.unit)})` : ''}` : '';
        }).join(', ')
      : p.ownOffer ? `${p.ownOffer}${p.ownOfferAmount ? ` (${quantity(p.ownOfferAmount, p.ownOfferUnit)})` : ''}` : '';
  }
  if (l.type === 'service') {
    d['how long each time'] = p.sessionLength && p.sessionLengthUnit ? length(p.sessionLength, p.sessionLengthUnit) : '';
    d['how many times'] = p.sessions ? String(p.sessions) : '';
  }
  return d;
}

const joinWords = (words: string[]) => (words.length <= 1 ? words.join('') : `${words.slice(0, -1).join(', ')}, and ${words.at(-1)}`);

// ── Accepting, declining, withdrawing ──────────────────────────────────────────────────────────

/**
 * The lister accepts exactly the details they saw (`version`). The arrangement becomes agreed, with
 * its agreed record (the place as resolved, what is given in return, a loan's period), and the
 * offering is updated atomically, with the offering row locked so two accepts can't hand out more than is left.
 * Overlapping loans are also refused by the database itself (research §4).
 */
export async function acceptArrangement(arrangementId: string, listerId: string, version: number) {
  const found = await loadArrangement(arrangementId);
  const peek = await offeringContext(found.offeringId);
  if (peek.offering.ownerId !== listerId) {
    if (found.requesterId === listerId) throw new ApiError(403, 'not_lister', `Only ${peek.ownerName} can accept this proposal.`);
    throw errors.notFound('That arrangement');
  }

  let result: { closedOthers: string[]; settled: Awaited<ReturnType<typeof closeForArrangement>> };
  try {
    result = await db.transaction(async (tx) => {
      await tx.select({ id: offering.id }).from(offering).where(eq(offering.id, found.offeringId)).for('update');
      const [p] = await tx.select().from(arrangement).where(eq(arrangement.id, arrangementId)).for('update');
      if (!p || p.status !== 'open') throw new ApiError(409, 'arrangement_ended', 'This proposal has ended, so it can no longer be accepted.');
      if (p.version !== version) {
        throw new ApiError(409, 'arrangement_changed', `${await nameOf(p.requesterId)} changed the details. Please check them again.`);
      }
      const ctx = await offeringContext(p.offeringId, tx);
      const offers = await offersOf(p.id, tx);
      const { issues } = arrangementIssues(p, offers, ctx);
      if (issues.length > 0) {
        throw new ApiError(409, 'arrangement_not_ready', 'This proposal still needs some details before it can be accepted.', undefined, { issues });
      }
      const l = ctx.offering;
      const now = new Date();
      // The asker's request this answers closes with the agreement (003 FR-016).
      const settled = p.requestId ? await closeForArrangement(tx, p.requestId, p.id) : null;

      // Calculated by PostgreSQL so decimals stay exact; close the offering when nothing is left.
      if ((l.type === 'gift' || l.type === 'trade') && l.remaining === null) {
        await tx.update(offering).set({ status: 'closed', closedReason: 'used_up', updatedAt: new Date() }).where(eq(offering.id, l.id));
      }
      if (p.amount && l.remaining !== null) {
        await tx.update(offering).set({ remaining: sql`${offering.remaining} - ${p.amount}`, updatedAt: new Date() }).where(eq(offering.id, l.id));
      }
      if (l.type === 'service' && l.sessionsRemaining !== null && p.sessions) {
        await tx.update(offering).set({ sessionsRemaining: sql`${offering.sessionsRemaining} - ${p.sessions}`, updatedAt: new Date() }).where(eq(offering.id, l.id));
      }
      await tx
        .update(offering)
        .set({ status: 'closed', closedReason: 'used_up' })
        .where(and(eq(offering.id, l.id), eq(offering.status, 'available'), or(eq(offering.remaining, '0'), eq(offering.sessionsRemaining, 0))));
      // From here the details are the fixed record; what could still change elsewhere is copied.
      await tx
        .update(arrangement)
        .set({
          status: 'agreed',
          agreedAt: now,
          agreedPlace: resolvedPlace(p, l),
          agreedOffer: l.type === 'trade' ? offerSnapshot(p, offers, ctx.accepts) : null,
          loanStartsAt: l.type === 'lend' ? p.startsAt : null,
          loanEndsAt: l.type === 'lend' ? loanEnd(p) : null,
          lastActivityAt: now,
          updatedAt: now
        })
        .where(eq(arrangement.id, p.id));

      // Nothing left: every other open proposal on it closes (FR-019).
      const [after] = await tx.select({ status: offering.status, closedReason: offering.closedReason }).from(offering).where(eq(offering.id, l.id));
      let closedOthers: string[] = [];
      if (after?.status === 'closed' && after.closedReason === 'used_up') {
        const closed = await tx
          .update(arrangement)
          .set({ status: 'closed', closedReason: 'nothing_left', updatedAt: new Date() })
          .where(and(eq(arrangement.offeringId, l.id), eq(arrangement.status, 'open'), ne(arrangement.id, p.id)))
          .returning({ id: arrangement.id });
        closedOthers = closed.map((c) => c.id);
      }
      return { closedOthers, settled };
    });
  } catch (err) {
    // PostgreSQL's exclusion constraint: another loan was accepted for overlapping dates meanwhile.
    if ((err as { code?: string }).code === '23P01' || (err as { cause?: { code?: string } }).cause?.code === '23P01') {
      throw new ApiError(409, 'dates_taken', 'Those dates were just taken by another loan. Please ask for other dates.');
    }
    if (err instanceof ApiError && err.code === 'arrangement_changed') {
      throw new ApiError(409, err.code, err.message, undefined, { arrangement: await getArrangement(arrangementId, listerId) });
    }
    throw err;
  }

  await afterAccept(arrangementId, listerId, result);
  if (result.settled) await announceSettled(result.settled, listerId);
  return getArrangement(arrangementId, listerId);
}

/** Notes and notices once an acceptance is saved: the requester, and others it affects. */
async function afterAccept(arrangementId: string, listerId: string, result: { closedOthers: string[] }) {
  const p = await loadArrangement(arrangementId);
  const ctx = await offeringContext(p.offeringId);
  const l = ctx.offering;
  const lister = await nameOf(listerId);
  await postEvent(await threadOf(arrangementId), listerId, { kind: 'accepted', body: `${lister} accepted this proposal. It's now agreed.` });
  await notify(p.requesterId, 'agreement', {
    title: `${lister} accepted: you've agreed on ${l.title}`,
    body: 'You can see what was agreed in wunan.',
    url: `/arrangements/${arrangementId}`
  });

  const goneWords = { lend: 'is no longer available', gift: 'has all been given away', trade: 'has all been traded', service: 'has no times left' } as const;
  for (const id of result.closedOthers) {
    const other = await loadArrangement(id);
    await postEvent(
      await threadOf(id),
      null,
      { kind: 'closed', body: `This proposal was closed because ${l.title} ${goneWords[l.type]}. Nobody did anything wrong.` },
      { title: `${l.title} ${goneWords[l.type]}`, body: 'Your proposal for it was closed.', to: [other.requesterId] }
    );
  }

  // Others still open that no longer fit: less is left than they ask for, or the dates are taken.
  const stillOpen = await db.select().from(arrangement).where(and(eq(arrangement.offeringId, l.id), eq(arrangement.status, 'open')));
  for (const other of stillOpen) {
    const { issues } = arrangementIssues(other, await offersOf(other.id), ctx);
    const affected = issues.find((i) => (i.field === 'amount' && i.message.startsWith('Only')) || i.field === 'sessions' || (i.field === 'date' && i.message.includes('already lent')));
    if (!affected) continue;
    await notify(other.requesterId, 'message', {
      title: l.type === 'lend' ? `Someone is borrowing the ${l.title} on those dates` : `Less of the ${l.title} is left than you asked for`,
      body: `${affected.message} You can change your proposal.`,
      url: `/arrangements/${other.id}`,
      conversationId: await threadOf(other.id)
    });
  }
}

function offerSnapshot(p: ArrangementRow, offers: OfferRow[], accepts: AcceptRow[]): AgreedOffer {
  return {
    items: offers.map((o) => {
      const thing = accepts.find((a) => a.id === o.tradeAcceptId)!;
      return { description: thing.description, amount: trimDecimal(o.amount ?? thing.amount), unit: thing.unit };
    }),
    own: p.ownOffer ? { description: p.ownOffer, amount: trimDecimal(p.ownOfferAmount), unit: p.ownOfferUnit } : null
  };
}

export async function declineArrangement(arrangementId: string, listerId: string, note: string | null) {
  const p = await loadArrangement(arrangementId);
  const ctx = await offeringContext(p.offeringId);
  if (ctx.offering.ownerId !== listerId) {
    if (p.requesterId === listerId) throw new ApiError(403, 'not_lister', 'You can withdraw your proposal instead.');
    throw errors.notFound('That arrangement');
  }
  await endArrangement(p, 'declined', note);
  const name = await nameOf(listerId);
  await postEvent(
    await threadOf(arrangementId),
    listerId,
    { kind: 'declined', body: `${name} declined this proposal.${note ? ` Their note: ${note}` : ''}` },
    { title: `${name} declined what you asked for ${ctx.offering.title}`, body: note ?? 'You can still look at it in wunan.' }
  );
  return getArrangement(arrangementId, listerId);
}

export async function withdrawArrangement(arrangementId: string, requesterId: string, note: string | null) {
  const p = await loadArrangement(arrangementId);
  const ctx = await offeringContext(p.offeringId);
  if (p.requesterId !== requesterId) {
    if (ctx.offering.ownerId === requesterId) throw new ApiError(403, 'not_requester', 'You can decline this proposal instead.');
    throw errors.notFound('That arrangement');
  }
  await endArrangement(p, 'withdrawn', note);
  const name = await nameOf(requesterId);
  await postEvent(
    await threadOf(arrangementId),
    requesterId,
    { kind: 'withdrawn', body: `${name} withdrew this proposal.${note ? ` Their note: ${note}` : ''}` },
    { title: `${name} withdrew what they asked for ${ctx.offering.title}`, body: note ?? 'Nothing else changes.' }
  );
  return getArrangement(arrangementId, requesterId);
}

async function endArrangement(p: ArrangementRow, status: 'declined' | 'withdrawn', note: string | null) {
  const ended = await db
    .update(arrangement)
    .set({ status, decisionNote: note, updatedAt: new Date() })
    .where(and(eq(arrangement.id, p.id), eq(arrangement.status, 'open')))
    .returning({ id: arrangement.id });
  if (ended.length === 0) throw new ApiError(409, 'arrangement_ended', 'This proposal has already ended.');
}

/**
 * Closes open arrangements for a reason nobody chose: a quiet month (FR-020a) or a member leaving.
 * Writes a note in each thread and tells the members still here.
 */
export async function closeArrangements(ids: string[], reason: 'quiet' | 'member_left') {
  for (const id of ids) {
    const [closed] = await db
      .update(arrangement)
      .set({ status: 'closed', closedReason: reason, updatedAt: new Date() })
      .where(and(eq(arrangement.id, id), eq(arrangement.status, 'open')))
      .returning();
    if (!closed) continue;
    const ctx = await offeringContext(closed.offeringId);
    const words =
      reason === 'quiet'
        ? { body: 'This proposal was closed after a quiet month. You can make a new one any time.', title: `Your arrangement for ${ctx.offering.title} was closed after a quiet month` }
        : { body: 'This proposal was closed because one of you left wunan.', title: `An arrangement for ${ctx.offering.title} was closed` };
    await postEvent(await threadOf(id), null, { kind: 'closed', body: words.body }, { title: words.title });
  }
}

/** Open arrangements with no message or change for 30 days close by themselves (002 FR-020a). */
export async function closeQuietArrangements(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const quiet = await db.select({ id: arrangement.id }).from(arrangement).where(and(eq(arrangement.status, 'open'), lt(arrangement.lastActivityAt, cutoff)));
  await closeArrangements(quiet.map((q) => q.id), 'quiet');
  return { closed: quiet.length };
}

// ── After agreeing ─────────────────────────────────────────────────────────────────────────────

/** The owner marks a loan returned; the rest of its period is free again (001 FR-025). */
export async function markReturned(arrangementId: string, memberId: string) {
  const { p, isLister } = await partyOf(arrangementId, memberId);
  if (!isLister) throw new ApiError(403, 'not_allowed', 'Only the owner can mark this returned.');
  if (!p.loanStartsAt) throw new ApiError(400, 'not_a_loan', 'Only loans can be marked returned.');
  if (p.returnedAt) throw new ApiError(409, 'already_returned', 'This loan is already finished.');
  await db.update(arrangement).set({ returnedAt: new Date(), updatedAt: new Date() }).where(eq(arrangement.id, arrangementId));
  await postEvent(await threadOf(arrangementId), memberId, { kind: 'returned', body: `${await nameOf(memberId)} marked it as returned.` });
  return getArrangement(arrangementId, memberId);
}

/**
 * Either member marks an agreed gift, trade or service as done (004 FR-009a). It is optional and
 * can be taken back; it changes nothing else, and nobody is notified or reminded: the note in the
 * conversation is how the other member sees it.
 */
export async function markDone(arrangementId: string, memberId: string) {
  const { p } = await partyOf(arrangementId, memberId);
  if (p.status !== 'agreed') throw new ApiError(409, 'not_agreed', 'This can be marked as done once it is agreed.');
  if (p.loanStartsAt) throw new ApiError(409, 'is_a_loan', 'A loan is marked returned by its owner instead.');
  if (p.doneAt) throw new ApiError(409, 'already_done', 'This is already marked as done.');
  await db.update(arrangement).set({ doneAt: new Date(), doneById: memberId, updatedAt: new Date() }).where(eq(arrangement.id, arrangementId));
  await postEvent(await threadOf(arrangementId), memberId, { kind: 'done', body: `${await nameOf(memberId)} marked it as done.` });
  return getArrangement(arrangementId, memberId);
}

export async function markNotDone(arrangementId: string, memberId: string) {
  const { p } = await partyOf(arrangementId, memberId);
  if (!p.doneAt) throw new ApiError(409, 'not_done', "This isn't marked as done.");
  await db.update(arrangement).set({ doneAt: null, doneById: null, updatedAt: new Date() }).where(eq(arrangement.id, arrangementId));
  await postEvent(await threadOf(arrangementId), memberId, { kind: 'not_done', body: `${await nameOf(memberId)} marked it as not done yet.` });
  return getArrangement(arrangementId, memberId);
}

/** The arrangement for one of its two members; anyone else gets "not found". */
async function partyOf(arrangementId: string, memberId: string) {
  const p = await loadArrangement(arrangementId);
  const [l] = await db.select({ ownerId: offering.ownerId }).from(offering).where(eq(offering.id, p.offeringId));
  const isLister = l?.ownerId === memberId;
  if (!isLister && p.requesterId !== memberId) throw errors.notFound('That arrangement');
  return { p, isLister };
}

// ── Reading ────────────────────────────────────────────────────────────────────────────────────

async function loadArrangement(arrangementId: string) {
  const [row] = await db.select().from(arrangement).where(eq(arrangement.id, arrangementId));
  if (!row) throw errors.notFound('That arrangement');
  return row;
}

async function threadOf(arrangementId: string) {
  const [row] = await db.select({ id: conversation.id }).from(conversation).where(eq(conversation.arrangementId, arrangementId));
  return row!.id;
}

async function nameOf(memberId: string) {
  const [row] = await db.select().from(member).where(eq(member.id, memberId));
  return row ? shownName(row) : 'A member';
}

// Helpers come with requests for help (modules/reports.ts sets these; importing it here would be circular).
/** Whether a member is helping with this arrangement, and whether its messages were shared with them. */
let helperAccess: (arrangementId: string, memberId: string) => Promise<'none' | 'helper' | 'reads_messages'> = async () => 'none';
export function setHelperCheck(check: typeof helperAccess) {
  helperAccess = check;
}
type ReportRef = { id: string; status: 'open' | 'resolved'; outcomeNote: string | null } & HelpRequest;
let reportsFor: (arrangementId: string) => Promise<ReportRef[]> = async () => [];
export function setReportsLookup(lookup: typeof reportsFor) {
  reportsFor = lookup;
}

/** The kinds of note the timeline is built from. Their text is never read here. */
const timelineKinds = ['asked', 'detail_changed', 'accepted', 'declined', 'withdrawn', 'closed', 'returned', 'done', 'not_done'] as const;

async function notesOf(conversationId: string): Promise<Note[]> {
  const rows = await db
    .select({ kind: message.kind, at: message.createdAt, authorId: message.authorId })
    .from(message)
    .where(and(eq(message.conversationId, conversationId), inArray(message.kind, [...timelineKinds])))
    .orderBy(asc(message.createdAt));
  const ids = [...new Set(rows.map((r) => r.authorId).filter((id): id is string => Boolean(id)))];
  const people = ids.length ? await db.select().from(member).where(inArray(member.id, ids)) : [];
  const byId = new Map(people.map((m) => [m.id, { id: m.id, displayName: shownName(m) }]));
  return rows.map((r) => ({ kind: r.kind, at: r.at, by: r.authorId ? (byId.get(r.authorId) ?? null) : null }));
}

/** A message written by the other member (never a note from wunan) that this member hasn't read. */
const unreadFromOther = (memberId: string): SQL<boolean> => sql<boolean>`exists (
  select 1 from conversation c
    join conversation_participant cp on cp.conversation_id = c.id and cp.member_id = ${memberId}
    join message m on m.conversation_id = c.id
   where c.arrangement_id = ${arrangement.id}
     and m.kind in ('text', 'call_accepted') and m.author_id <> ${memberId}
     and (cp.last_read_at is null or m.created_at > cp.last_read_at))`;

/**
 * One arrangement, with its details, what blocks accepting, its stage and timeline, and what this
 * member may do. For its requester and lister; a helper from a request for help may read it once
 * it is agreed, without actions, and with the messages only if they were shared (FR-021a).
 */
export async function getArrangement(arrangementId: string, memberId: string) {
  const p = await loadArrangement(arrangementId);
  const ctx = await offeringContext(p.offeringId);
  const l = ctx.offering;
  const isLister = l.ownerId === memberId;
  const isParty = isLister || p.requesterId === memberId;
  const helping = isParty ? 'none' : await helperAccess(p.id, memberId);
  if (!isParty && (helping === 'none' || p.status !== 'agreed')) throw errors.notFound('That arrangement');

  const offers = await offersOf(p.id);
  const { issues, areaUnchecked } = p.status === 'open' ? arrangementIssues(p, offers, ctx) : { issues: [], areaUnchecked: false };
  const [requester] = await db.select().from(member).where(eq(member.id, p.requesterId));
  const local = p.startsAt ? instantToLocal(p.startsAt) : null;
  const agreed = p.status === 'agreed';
  const loanOut = agreed && p.loanStartsAt && !p.returnedAt;
  const earlierLoan =
    l.type === 'lend' && p.startsAt && (p.status === 'open' || loanOut)
      ? await earlierLoanNotBack(l.id, p.loanStartsAt ?? p.startsAt, agreed ? p.id : undefined)
      : null;
  const threadId = await threadOf(p.id);
  const reports = await reportsFor(p.id);

  return {
    id: p.id,
    status: p.status,
    closedReason: p.closedReason,
    stage: stageOf(p),
    version: p.version,
    offering: { id: l.id, title: l.title, type: l.type, unit: l.unit },
    requester: { id: p.requesterId, displayName: requester ? shownName(requester) : 'A member' },
    lister: { id: l.ownerId, displayName: ctx.ownerName },
    details: {
      startsAt: p.startsAt?.toISOString() ?? null,
      hasTime: p.hasTime,
      date: local?.date ?? null,
      time: p.hasTime ? (local?.time ?? null) : null,
      handover: p.handover,
      // The offering's own place shows only its display until agreed (or to the lister).
      place: viewPlace(agreed ? p.agreedPlace : resolvedPlace(p, l), { full: !placeFromOffering(p) || isLister || agreed }),
      loanLength: p.loanLength,
      loanLengthUnit: p.loanLengthUnit,
      amount: trimDecimal(p.amount),
      offers: offers.flatMap((o) => {
        const thing = ctx.accepts.find((a) => a.id === o.tradeAcceptId);
        return thing ? [{ acceptId: thing.id, description: thing.description, amount: trimDecimal(o.amount), unit: thing.unit }] : [];
      }),
      ownOffer: p.ownOffer,
      ownOfferAmount: trimDecimal(p.ownOfferAmount),
      ownOfferUnit: p.ownOfferUnit,
      sessionLength: p.sessionLength,
      sessionLengthUnit: p.sessionLengthUnit,
      sessions: p.sessions
    },
    issues,
    areaUnchecked,
    request: await requestOf(p.requestId),
    agreed: agreed
      ? {
          at: p.agreedAt!.toISOString(),
          // Only the two members and helpers get here, and they all may see the place in full.
          place: viewPlace(p.agreedPlace, { full: true }),
          offer: p.agreedOffer,
          loanStartsAt: p.loanStartsAt?.toISOString() ?? null,
          loanEndsAt: p.loanEndsAt?.toISOString() ?? null,
          overdue: isOverdue(p),
          returnedAt: p.returnedAt?.toISOString() ?? null,
          doneAt: p.doneAt?.toISOString() ?? null,
          doneBy: p.doneById ? { id: p.doneById, displayName: await nameOf(p.doneById) } : null
        }
      : null,
    earlierLoanNotBack: earlierLoan,
    timeline: timelineOf(await notesOf(threadId), p, reports),
    reports: reports.map((r) => ({ id: r.id, status: r.status, outcomeNote: r.outcomeNote })),
    canAccept: isLister && p.status === 'open' && issues.length === 0,
    canEdit: isParty && !isLister && p.status === 'open',
    canAskAgain: isParty && !isLister && p.status !== 'open' && !agreed && l.status === 'available',
    myRole: isLister ? ('lister' as const) : isParty ? ('requester' as const) : ('helper' as const),
    conversationId: isParty || helping === 'reads_messages' ? threadId : null,
    decisionNote: p.decisionNote,
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString()
  };
}

/** The request an arrangement answers, for "For your request: …" (003). */
async function requestOf(requestId: string | null) {
  if (!requestId) return null;
  const [row] = await db.select({ id: request.id, title: request.title, status: request.status }).from(request).where(eq(request.id, requestId));
  return row ?? null;
}

// ── The list ───────────────────────────────────────────────────────────────────────────────────

/** Returned, marked as done, or ended without agreement: what goes under "Finished". */
const finished = sql<boolean>`(${arrangement.status} in ('declined', 'withdrawn', 'closed') or ${arrangement.returnedAt} is not null or ${arrangement.doneAt} is not null)`;
const FINISHED_PAGE = 20;

type ListQuery = { side?: 'asked' | 'offered' | undefined; group?: 'finished' | undefined; cursor?: string | undefined };

/**
 * My arrangements under the list's three headings (004 FR-001 to FR-006, research §7), each newest
 * activity first. "Waiting on you" and "In progress" come in full; "Finished" 20 at a time. With
 * `group: 'finished'` only the next finished page is returned. Arrangements I only help with are
 * never here.
 */
export async function listArrangements(memberId: string, query: ListQuery = {}) {
  const mine = mineCondition(memberId, query.side);
  const unread = unreadFromOther(memberId);
  const newestFirst = [desc(arrangement.lastActivityAt), desc(arrangement.id)];

  let needsYou: Summary[] = [];
  let inProgress: Summary[] = [];
  if (query.group !== 'finished') {
    // Everything still going, plus anything finished that has an unread message from the other member.
    const rows = await db
      .select({ arrangement, offering, unread })
      .from(arrangement)
      .innerJoin(offering, eq(offering.id, arrangement.offeringId))
      .where(and(mine, or(sql`not ${finished}`, unread)))
      .orderBy(...newestFirst);
    const summaries = await summarise(rows, memberId);
    needsYou = summaries.filter((s) => groupOf(s.stage, s.needsMe) === 'needsYou');
    inProgress = summaries.filter((s) => groupOf(s.stage, s.needsMe) === 'inProgress');
  }

  const offset = Math.max(0, Number(query.cursor ?? 0) || 0);
  const rows = await db
    .select({ arrangement, offering, unread })
    .from(arrangement)
    .innerJoin(offering, eq(offering.id, arrangement.offeringId))
    .where(and(mine, finished, sql`not ${unread}`))
    .orderBy(...newestFirst)
    .offset(offset)
    .limit(FINISHED_PAGE + 1);
  return {
    needsYou,
    inProgress,
    finished: await summarise(rows.slice(0, FINISHED_PAGE), memberId),
    finishedNext: rows.length > FINISHED_PAGE ? String(offset + FINISHED_PAGE) : null
  };
}

/** How many of my arrangements are under "Waiting on you": the one count in the header (FR-019). */
export async function countNeedingMe(memberId: string) {
  const rows = await db
    .select({ arrangement, offering, unread: unreadFromOther(memberId) })
    .from(arrangement)
    .innerJoin(offering, eq(offering.id, arrangement.offeringId))
    .where(and(mineCondition(memberId), or(sql`not ${finished}`, unreadFromOther(memberId))));
  return (await summarise(rows, memberId)).filter((s) => s.needsMe).length;
}

/**
 * For Home (007): my arrangements waiting on me (the same rule as "Waiting on you"), oldest activity
 * first, and agreed loans not returned that are due back before `dueBefore` (or late) and not
 * already waiting on me, soonest first. One query and one `summarise`, as for the header count.
 */
export async function homeArrangements(memberId: string, dueBefore: Date) {
  const rows = await db
    .select({ arrangement, offering, unread: unreadFromOther(memberId) })
    .from(arrangement)
    .innerJoin(offering, eq(offering.id, arrangement.offeringId))
    .where(and(mineCondition(memberId), or(sql`not ${finished}`, unreadFromOther(memberId))))
    .orderBy(asc(arrangement.lastActivityAt), asc(arrangement.id));
  const summaries = await summarise(rows, memberId);
  const waiting = summaries.filter((s) => s.needsMe);
  const dueBack = summaries
    .filter((s) => !s.needsMe && s.status === 'agreed' && s.loanEndsAt && !s.returnedAt && new Date(s.loanEndsAt) < dueBefore)
    .sort((a, b) => a.loanEndsAt!.localeCompare(b.loanEndsAt!))
    .map((s) => ({
      arrangementId: s.id,
      myRole: s.myRole,
      otherMember: s.otherMember,
      offering: { id: s.offering.id, title: s.offering.title },
      loanEndsAt: s.loanEndsAt!,
      overdue: s.overdue
    }));
  return { waiting, dueBack };
}

const mineCondition = (memberId: string, side?: 'asked' | 'offered') =>
  side === 'asked' ? eq(arrangement.requesterId, memberId) : side === 'offered' ? eq(offering.ownerId, memberId) : or(eq(arrangement.requesterId, memberId), eq(offering.ownerId, memberId));

type Summary = Awaited<ReturnType<typeof summarise>>[number];

async function summarise(rows: { arrangement: ArrangementRow; offering: OfferingRow; unread: boolean }[], memberId: string) {
  if (rows.length === 0) return [];
  // Everything the summaries need is loaded in a few queries for the whole page, never one per
  // arrangement, so the list stays quick for a member with hundreds (004 SC-007).
  const offeringIds = [...new Set(rows.map((r) => r.offering.id))];
  const openIds = rows.filter((r) => r.arrangement.status === 'open').map((r) => r.arrangement.id);
  const [people, accepts, times, loans, offers, lastTexts] = await Promise.all([
    db.select().from(member).where(inArray(member.id, [...new Set(rows.flatMap((r) => [r.arrangement.requesterId, r.offering.ownerId]))])),
    db.select().from(tradeAccept).where(inArray(tradeAccept.offeringId, offeringIds)).orderBy(asc(tradeAccept.position)),
    db.select().from(serviceAvailability).where(inArray(serviceAvailability.offeringId, offeringIds)),
    db
      .select({ id: arrangement.id, offeringId: arrangement.offeringId, startsAt: arrangement.loanStartsAt, endsAt: arrangement.loanEndsAt })
      .from(arrangement)
      .where(and(inArray(arrangement.offeringId, offeringIds), isNotNull(arrangement.loanStartsAt), isNull(arrangement.returnedAt)))
      .orderBy(asc(arrangement.loanStartsAt)),
    openIds.length
      ? db
          .select({ arrangementId: arrangementOffer.arrangementId, tradeAcceptId: arrangementOffer.tradeAcceptId, amount: arrangementOffer.amount })
          .from(arrangementOffer)
          .where(inArray(arrangementOffer.arrangementId, openIds))
      : Promise.resolve([]),
    // The latest message written by a person in each arrangement's conversation.
    db
      .selectDistinctOn([conversation.arrangementId], { arrangementId: conversation.arrangementId, body: message.body })
      .from(message)
      .innerJoin(conversation, eq(conversation.id, message.conversationId))
      .where(and(inArray(conversation.arrangementId, rows.map((r) => r.arrangement.id)), eq(message.kind, 'text')))
      .orderBy(conversation.arrangementId, desc(message.createdAt))
  ]);
  const nameById = new Map(people.map((m) => [m.id, shownName(m)]));
  const lastText = new Map(lastTexts.map((t) => [t.arrangementId, t.body]));
  const contextOf = (l: OfferingRow): OfferingContext => ({
    offering: l,
    ownerName: nameById.get(l.ownerId) ?? 'The lister',
    accepts: accepts.filter((a) => a.offeringId === l.id),
    times: times.filter((t) => t.offeringId === l.id),
    loans: loans.filter((loan) => loan.offeringId === l.id)
  });

  return rows.map(({ arrangement: p, offering: l, unread }) => {
    const isLister = l.ownerId === memberId;
    const mine = offers.filter((o) => o.arrangementId === p.id);
    const { issues } = p.status === 'open' ? arrangementIssues(p, mine, contextOf(l)) : { issues: [] };
    const last = lastText.get(p.id);
    return {
      id: p.id,
      status: p.status,
      closedReason: p.closedReason,
      stage: stageOf(p),
      needsMe: needsMe(p, { role: isLister ? 'lister' : 'requester', unreadFromOther: unread }, issues),
      offering: { id: l.id, title: l.title, type: l.type },
      otherMember: {
        id: isLister ? p.requesterId : l.ownerId,
        displayName: nameById.get(isLister ? p.requesterId : l.ownerId) ?? 'A member'
      },
      myRole: isLister ? ('lister' as const) : ('requester' as const),
      issues,
      startsAt: p.startsAt?.toISOString() ?? null,
      hasTime: p.hasTime,
      loanEndsAt: p.loanEndsAt?.toISOString() ?? null,
      overdue: isOverdue(p),
      returnedAt: p.returnedAt?.toISOString() ?? null,
      doneAt: p.doneAt?.toISOString() ?? null,
      unread,
      lastActivityAt: p.lastActivityAt.toISOString(),
      lastMessagePreview: last ? last.slice(0, 100) : null
    };
  });
}

/** Open arrangements a member made or received, for closing when they leave wunan. */
export async function openArrangementsOf(memberId: string) {
  const rows = await db
    .select({ id: arrangement.id })
    .from(arrangement)
    .innerJoin(offering, eq(offering.id, arrangement.offeringId))
    .where(and(eq(arrangement.status, 'open'), or(eq(arrangement.requesterId, memberId), eq(offering.ownerId, memberId))));
  return rows.map((r) => r.id);
}

setArrangementCloser(async (memberId) => closeArrangements(await openArrangementsOf(memberId), 'member_left'));

/**
 * Used by reminders: loans not returned and never reminded, whose end date (in the community's time
 * zone) is before today, i.e. it's at least the day after they were due back (001 FR-025).
 */
export const overdueLoansCondition = () => {
  const zone = communityTimeZone();
  return and(
    isNull(arrangement.returnedAt),
    isNull(arrangement.reminderSentAt),
    isNotNull(arrangement.loanEndsAt),
    sql`(${arrangement.loanEndsAt} at time zone ${zone})::date < (now() at time zone ${zone})::date`
  );
};
