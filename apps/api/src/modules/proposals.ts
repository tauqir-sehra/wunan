// Proposals (002 FR-010 to FR-021, research §3–§6): a member asks for something on someone else's
// offering. Every detail is optional; only the requester changes them, and what the proposal says is
// what the requester has agreed to. The lister accepts once nothing blocks it, which makes the
// agreement in one transaction. What blocks it ("issues") is worked out each time by
// `proposalIssues`, never stored, so an offering edit never leaves a stale flag behind.
import type { AgreementOfferSnapshot, CreateProposal, Place, ProposalDetailsInput, ProposalIssue } from '@wunan/shared';
import { and, asc, desc, eq, isNotNull, isNull, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  agreement,
  conversation,
  conversationParticipant,
  offering,
  member,
  message,
  proposal,
  proposalOffer,
  request,
  requestLink,
  serviceAvailability,
  tradeAccept
} from '../db/schema/index.ts';
import { ApiError, errors } from '../lib/errors.ts';
import { addLength, describeWhen, instantToLocal, lengthInMinutes, localToInstant, localWeekday } from '../lib/time.ts';
import { notify } from '../notify/index.ts';
import { outcomeFor } from './agreements.ts';
import { announceSettled, closeForAgreement } from './requests.ts';
import { earlierLoanNotBack, trimDecimal, unreturnedLoans } from './offerings.ts';
import { setProposalCloser, shownName } from './members.ts';
import { createThread, postEvent } from './messaging.ts';
import { displayOf, sameArea, viewPlace } from './places.ts';

type ProposalRow = typeof proposal.$inferSelect;
type OfferingRow = typeof offering.$inferSelect;
type AcceptRow = typeof tradeAccept.$inferSelect;
type TimeRow = typeof serviceAvailability.$inferSelect;
type Loan = Awaited<ReturnType<typeof unreturnedLoans>>[number];
type OfferRow = { tradeAcceptId: string; amount: string | null };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Everything about an offering that decides whether a proposal fits it. */
type OfferingContext = { offering: OfferingRow; ownerName: string; accepts: AcceptRow[]; times: TimeRow[]; loans: Loan[] };

// ── Words ──────────────────────────────────────────────────────────────────────────────────────

const whenWord = { lend: 'pickup time', gift: 'pickup time', trade: 'time to trade', service: 'time' } as const;

/** How the handover happens, in words for this type (research §6). */
export function handoverWords(type: OfferingRow['type'], handover: NonNullable<ProposalRow['handover']>, names: { lister: string; requester: string }) {
  const goods = type === 'lend' || type === 'gift';
  switch (handover) {
    case 'to_requester':
      return goods ? `Dropped off to ${names.requester}` : `At ${names.requester}'s`;
    case 'at_lister':
      return goods ? `Picked up from ${names.lister}` : `At ${names.lister}'s`;
    case 'elsewhere':
      return type === 'service' ? 'Somewhere else' : 'Meet somewhere else';
    case 'online':
      return 'Online';
  }
}

const unitWords: Record<string, [string, string]> = {
  minutes: ['minute', 'minutes'],
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
  weeks: ['week', 'weeks']
};
const length = (n: number, unit: string) => `${n} ${unitWords[unit]![n === 1 ? 0 : 1]}`;
const quantity = (amount: string, unit: string | null) => (unit && unit !== 'item' ? `${trimDecimal(amount)} ${unit}` : trimDecimal(amount)!);

const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Monday–Friday, 18:00–21:00; Saturday, 10:00–12:00": consecutive days with the same hours grouped. */
export function describeTimes(times: { weekday: number; startTime: string; endTime: string }[]) {
  const byHours = new Map<string, number[]>();
  for (const t of times) {
    const key = `${t.startTime.slice(0, 5)}–${t.endTime.slice(0, 5)}`;
    byHours.set(key, [...(byHours.get(key) ?? []), t.weekday]);
  }
  const parts: string[] = [];
  for (const [hours, days] of byHours) {
    const sorted = [...new Set(days)].sort();
    const runs: string[] = [];
    let start = sorted[0]!;
    for (let i = 1; i <= sorted.length; i += 1) {
      if (sorted[i] !== sorted[i - 1]! + 1) {
        const end = sorted[i - 1]!;
        runs.push(start === end ? dayNames[start]! : `${dayNames[start]}–${dayNames[end]}`);
        start = sorted[i]!;
      }
    }
    parts.push(`${runs.join(', ')}, ${hours}`);
  }
  return parts.join('; ');
}

// ── Loading ────────────────────────────────────────────────────────────────────────────────────

async function offeringContext(offeringId: string, tx: Transaction | typeof db = db): Promise<OfferingContext> {
  const [row] = await tx.select().from(offering).where(eq(offering.id, offeringId));
  if (!row) throw errors.notFound('That offering');
  const [owner] = await tx.select().from(member).where(eq(member.id, row.ownerId));
  const accepts = await tx.select().from(tradeAccept).where(eq(tradeAccept.offeringId, offeringId)).orderBy(asc(tradeAccept.position));
  const times = await tx.select().from(serviceAvailability).where(eq(serviceAvailability.offeringId, offeringId));
  const loans = await tx
    .select({ id: agreement.id, offeringId: agreement.offeringId, startsAt: agreement.loanStartsAt, endsAt: agreement.loanEndsAt })
    .from(agreement)
    .where(and(eq(agreement.offeringId, offeringId), isNotNull(agreement.loanStartsAt), isNull(agreement.returnedAt)))
    .orderBy(asc(agreement.loanStartsAt));
  return { offering: row, ownerName: owner ? shownName(owner) : 'The lister', accepts, times, loans };
}

const offersOf = (proposalId: string, tx: Transaction | typeof db = db) =>
  tx.select({ tradeAcceptId: proposalOffer.tradeAcceptId, amount: proposalOffer.amount }).from(proposalOffer).where(eq(proposalOffer.proposalId, proposalId));

/** The place a proposal happens at: its own, or the offering's area or meeting place (research §6). */
function resolvedPlace(p: ProposalRow, l: OfferingRow): Place | null {
  if (p.handover === 'online') return null;
  if (p.handover === 'at_lister') return l.area;
  if (p.handover === 'elsewhere') return p.place ?? l.meetingPlace;
  return p.place;
}
/** Whether the place shown comes from the offering, so only its display is shown until accepted. */
const placeFromOffering = (p: ProposalRow) => p.handover === 'at_lister' || (p.handover === 'elsewhere' && !p.place);

const loanEnd = (p: ProposalRow) => (p.startsAt && p.loanLength && p.loanLengthUnit ? addLength(p.startsAt, p.loanLength, p.loanLengthUnit) : null);

// ── Issues ─────────────────────────────────────────────────────────────────────────────────────

/**
 * What stops the lister from accepting, in plain words (data-model "Issues"). An empty list means
 * it can be accepted. `areaUnchecked` is true when wunan couldn't compare a typed place with the
 * offering's area, so the lister decides.
 */
export function proposalIssues(p: ProposalRow, offers: OfferRow[], ctx: OfferingContext, now = new Date()) {
  const l = ctx.offering;
  const issues: ProposalIssue[] = [];
  const add = (field: string, text: string) => issues.push({ field, message: text });
  let areaUnchecked = false;

  if (l.status !== 'available') add('offering', `This offering is ${l.status === 'paused' ? 'paused' : 'closed'} right now, so it can't be agreed.`);

  // When
  if (!p.startsAt) add('date', `Please choose the ${whenWord[l.type]}.`);
  else if (p.hasTime ? p.startsAt < now : instantToLocal(p.startsAt).date < instantToLocal(now).date) {
    add('date', 'That time has passed. Please choose a new one.');
  }

  // How and where
  if (!p.handover) add('handover', 'Please choose how it happens.');
  else if (l.handovers.length > 0 && !l.handovers.includes(p.handover)) {
    const names = { lister: ctx.ownerName, requester: 'you' };
    add('handover', `${ctx.ownerName} offered: ${l.handovers.map((h) => handoverWords(l.type, h, names).toLowerCase()).join(', or ')}.`);
  } else if (p.handover !== 'online') {
    const place = resolvedPlace(p, l);
    if (!place) {
      add('place', p.handover === 'at_lister' ? `${ctx.ownerName} hasn't added their area yet. Please choose another way, or ask them.` : 'Please choose where.');
    } else if (l.type === 'service' && l.area && p.handover === 'elsewhere') {
      // Only a place to meet must be in the offering's area. How far a lister will travel to the
      // recipient is theirs to agree in messages, so a drop-off place is never checked.
      const inside = sameArea(l.area, place);
      if (inside === false) add('place', `${ctx.ownerName} offers this in ${displayOf(l.area)} only.`);
      if (inside === null) areaUnchecked = true;
    }
  }

  switch (l.type) {
    case 'lend': {
      if (!p.loanLength || !p.loanLengthUnit) add('loanLength', 'Please choose how long you would like to borrow it.');
      else if (l.loanLength && l.loanLengthUnit && lengthInMinutes(p.loanLength, p.loanLengthUnit) > lengthInMinutes(l.loanLength, l.loanLengthUnit)) {
        add('loanLength', `${ctx.ownerName} lends this for up to ${length(l.loanLength, l.loanLengthUnit)} but your proposal of ${length(p.loanLength, p.loanLengthUnit)} exceeds it.`);
      }
      const end = loanEnd(p);
      if (p.startsAt && end) {
        const clash = ctx.loans.find((loan) => loan.startsAt! < end && p.startsAt! < loan.endsAt!);
        if (clash) {
          add('date', `It's already lent then (${describeWhen(clash.startsAt!, false)} to ${describeWhen(clash.endsAt!, false)}). Please choose other dates.`);
        }
      }
      break;
    }
    case 'gift':
    case 'trade':
      if (l.remaining !== null) {
        if (!p.amount) add('amount', 'Please choose how much.');
        else if (Number(p.amount) > Number(l.remaining)) add('amount', `Only ${quantity(l.remaining, l.unit)} is left.`);
      }
      if (l.type === 'trade') {
        if (ctx.accepts.length > 0) {
          if (offers.length === 0) add('offers', 'Please choose what you offer from the list.');
          for (const offer of offers) {
            const thing = ctx.accepts.find((a) => a.id === offer.tradeAcceptId);
            if (thing?.amount && offer.amount && Number(offer.amount) > Number(thing.amount)) {
              add('offers', `${ctx.ownerName} would accept up to ${quantity(thing.amount, thing.unit)} of ${thing.description}.`);
            }
          }
        } else if (!p.ownOffer) add('ownOffer', 'Please say what you offer in return.');
      }
      break;
    case 'service': {
      if (!p.sessionLength || !p.sessionLengthUnit) add('sessionLength', 'Please choose how long each time.');
      else if (l.sessionLength && l.sessionLengthUnit && lengthInMinutes(p.sessionLength, p.sessionLengthUnit) > lengthInMinutes(l.sessionLength, l.sessionLengthUnit)) {
        add('sessionLength', `Each time can be up to ${length(l.sessionLength, l.sessionLengthUnit)}.`);
      }
      if (!p.sessions) add('sessions', 'Please choose how many times.');
      else if (l.sessionsRemaining !== null && p.sessions > l.sessionsRemaining) {
        add('sessions', `Only ${l.sessionsRemaining} ${l.sessionsRemaining === 1 ? 'time is' : 'times are'} left.`);
      }
      if (ctx.times.length > 0 && p.startsAt && !fitsTimes(p, ctx.times)) {
        add('date', `${ctx.ownerName} offers this ${describeTimes(ctx.times)}.${p.hasTime ? '' : ' Please choose a time too.'}`);
      }
      break;
    }
  }
  return { issues, areaUnchecked };
}

/** A service time fits when it starts inside a weekly time, and (for minutes or hours) ends inside it too. */
function fitsTimes(p: ProposalRow, times: TimeRow[]) {
  if (!p.startsAt || !p.hasTime) return false;
  const start = instantToLocal(p.startsAt);
  const end = p.sessionLength && p.sessionLengthUnit && (p.sessionLengthUnit === 'minutes' || p.sessionLengthUnit === 'hours')
    ? addLength(p.startsAt, p.sessionLength, p.sessionLengthUnit)
    : null;
  const endLocal = end ? instantToLocal(end) : null;
  return times.some((t) => {
    if (t.weekday !== localWeekday(p.startsAt!)) return false;
    const from = t.startTime.slice(0, 5);
    const to = t.endTime.slice(0, 5);
    if (start.time < from || start.time >= to) return false;
    if (!endLocal) return true;
    return endLocal.date === start.date && endLocal.time <= to;
  });
}

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
function toValues(input: ProposalDetailsInput, current: ProposalRow | null, ctx: OfferingContext) {
  const l = ctx.offering;
  const allowed = new Set<string>([...commonFields, ...typeFields[l.type]]);
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined && value !== null && !allowed.has(key)) fields[key] = "This doesn't apply to this kind of offering.";
  }
  const values: Partial<typeof proposal.$inferInsert> = {};
  const has = (key: keyof ProposalDetailsInput) => input[key] !== undefined;

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
  const pair = (n: keyof ProposalDetailsInput, u: keyof ProposalDetailsInput, unitMessage: string) => {
    if (!has(n) && !has(u)) return;
    const number = has(n) ? input[n] : current?.[n as keyof ProposalRow];
    const unit = has(u) ? input[u] : current?.[u as keyof ProposalRow];
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

async function saveOffers(tx: Transaction, proposalId: string, offers: ProposalDetailsInput['offers']) {
  if (offers === undefined) return;
  await tx.delete(proposalOffer).where(eq(proposalOffer.proposalId, proposalId));
  const unique = [...new Map((offers ?? []).map((o) => [o.acceptId, o])).values()];
  if (unique.length) await tx.insert(proposalOffer).values(unique.map((o) => ({ proposalId, tradeAcceptId: o.acceptId, amount: o.amount ?? null })));
}

// ── Making and changing ────────────────────────────────────────────────────────────────────────

const askedWords = { lend: 'asked to borrow your', gift: 'asked for your', trade: 'offered a trade for your', service: 'asked for your' } as const;

export async function createProposal(offeringId: string, requesterId: string, input: CreateProposal) {
  const ctx = await offeringContext(offeringId);
  const l = ctx.offering;
  if (l.ownerId === requesterId) throw new ApiError(400, 'own_offering', "This is your own offering, so you can't make a proposal on it.");
  if (l.status !== 'available') throw new ApiError(409, 'not_available', "This offering isn't available right now, so a proposal can't be made.");
  const [existing] = await db
    .select({ id: proposal.id })
    .from(proposal)
    .where(and(eq(proposal.offeringId, offeringId), eq(proposal.requesterId, requesterId), eq(proposal.status, 'open')));
  if (existing) throw alreadyProposed(existing.id);

  const { message: firstMessage, requestId: chosenRequest, ...details } = input;
  const requestId = await requestTiedTo(offeringId, requesterId, chosenRequest);
  const values = toValues(details, null, ctx);
  // Gift and Trade amounts start at all that's left (FR-012, FR-013).
  if ((l.type === 'gift' || l.type === 'trade') && values.amount === undefined && l.remaining !== null) values.amount = l.remaining;

  let created: { id: string; conversationId: string };
  try {
    created = await db.transaction(async (tx) => {
      const [row] = await tx.insert(proposal).values({ ...values, offeringId, requesterId, requestId }).returning({ id: proposal.id });
      await saveOffers(tx, row!.id, details.offers);
      const thread = await createThread(tx, { proposalId: row!.id }, [requesterId, l.ownerId]);
      return { id: row!.id, conversationId: thread.id };
    });
  } catch (err) {
    // Two clicks at once: the second one hits the one-open-proposal index.
    const [again] = await db.select({ id: proposal.id }).from(proposal).where(and(eq(proposal.offeringId, offeringId), eq(proposal.requesterId, requesterId), eq(proposal.status, 'open')));
    if (again) throw alreadyProposed(again.id);
    throw err;
  }

  const [requester] = await db.select().from(member).where(eq(member.id, requesterId));
  const notice = { title: `${requester?.displayName ?? 'A member'} ${askedWords[l.type]} ${l.title}`, body: firstMessage ?? 'Have a look at their proposal.' };
  if (firstMessage) await postEvent(created.conversationId, requesterId, { kind: 'text', body: firstMessage }, notice);
  else await notify(l.ownerId, 'message', { ...notice, url: `/proposals/${created.id}`, conversationId: created.conversationId });
  return { id: created.id, conversationId: created.conversationId };
}

/**
 * Which of the requester's open requests this proposal answers (003 research §3): only one of their
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

const alreadyProposed = (proposalId: string) =>
  new ApiError(409, 'proposal_exists', 'You already have a proposal open on this offering. You can change it instead.', undefined, { proposalId });

/** The requester changes details (FR-016). Each change is noted in the thread in plain words. */
export async function updateProposal(proposalId: string, requesterId: string, input: ProposalDetailsInput) {
  const current = await loadProposal(proposalId);
  if (current.requesterId !== requesterId) {
    const ctx = await offeringContext(current.offeringId);
    if (ctx.offering.ownerId === requesterId) throw new ApiError(403, 'not_requester', `Only the person who made the proposal can change it. You can ask them in a message.`);
    throw errors.notFound('That proposal');
  }
  if (current.status !== 'open') throw new ApiError(409, 'proposal_ended', 'This proposal has ended, so it can no longer be changed.');
  const ctx = await offeringContext(current.offeringId);
  const values = toValues(input, current, ctx);
  const before = await describeDetails(current, await offersOf(proposalId), ctx);

  await db.transaction(async (tx) => {
    await tx
      .update(proposal)
      .set({ ...values, version: sql`${proposal.version} + 1`, updatedAt: new Date() })
      .where(eq(proposal.id, proposalId));
    await saveOffers(tx, proposalId, input.offers);
  });

  const updated = await loadProposal(proposalId);
  const after = await describeDetails(updated, await offersOf(proposalId), ctx);
  const changes = Object.keys(after).filter((key) => before[key] !== after[key]);
  const [requester] = await db.select().from(member).where(eq(member.id, requesterId));
  const name = requester?.displayName ?? 'The requester';
  if (changes.length > 0) {
    const words = changes.map((key) => (after[key] ? `${key} to ${after[key]}` : `cleared ${key}`));
    await postEvent(
      await threadOf(proposalId),
      requesterId,
      { kind: 'detail_changed', body: `${name} changed ${joinWords(words)}.` },
      { title: `${name} changed their proposal for ${ctx.offering.title}`, body: 'Have a look at the new details.' }
    );
  }
  return getProposal(proposalId, requesterId);
}

/** Each detail as words, keyed by how it's named in "Robin changed the pickup time to …". */
async function describeDetails(p: ProposalRow, offers: OfferRow[], ctx: OfferingContext): Promise<Record<string, string>> {
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
 * The lister accepts exactly the details they saw (`version`). Creates the agreement and updates the
 * offering atomically, with the offering row locked so two accepts can't hand out more than is left.
 * Overlapping loans are also refused by the database itself (research §4).
 */
export async function acceptProposal(proposalId: string, listerId: string, version: number) {
  const found = await loadProposal(proposalId);
  const peek = await offeringContext(found.offeringId);
  if (peek.offering.ownerId !== listerId) {
    if (found.requesterId === listerId) throw new ApiError(403, 'not_lister', `Only ${peek.ownerName} can accept this proposal.`);
    throw errors.notFound('That proposal');
  }

  let result: { agreementId: string; closedOthers: string[]; settled: Awaited<ReturnType<typeof closeForAgreement>> };
  try {
    result = await db.transaction(async (tx) => {
      await tx.select({ id: offering.id }).from(offering).where(eq(offering.id, found.offeringId)).for('update');
      const [p] = await tx.select().from(proposal).where(eq(proposal.id, proposalId)).for('update');
      if (!p || p.status !== 'open') throw new ApiError(409, 'proposal_ended', 'This proposal has ended, so it can no longer be accepted.');
      if (p.version !== version) {
        throw new ApiError(409, 'proposal_changed', `${await nameOf(p.requesterId)} changed the details. Please check them again.`);
      }
      const ctx = await offeringContext(p.offeringId, tx);
      const offers = await offersOf(p.id, tx);
      const { issues } = proposalIssues(p, offers, ctx);
      if (issues.length > 0) {
        throw new ApiError(409, 'proposal_not_ready', 'This proposal still needs some details before it can be accepted.', undefined, { issues });
      }
      const l = ctx.offering;
      const place = resolvedPlace(p, l);
      const [saved] = await tx
        .insert(agreement)
        .values({
          proposalId: p.id,
          offeringId: l.id,
          ownerId: l.ownerId,
          otherMemberId: p.requesterId,
          outcome: outcomeFor[l.type],
          startsAt: p.startsAt,
          hasTime: p.hasTime,
          handover: p.handover,
          place,
          amount: p.amount,
          sessions: p.sessions,
          sessionLength: p.sessionLength,
          sessionLengthUnit: p.sessionLengthUnit,
          offer: l.type === 'trade' ? offerSnapshot(p, offers, ctx.accepts) : null,
          loanStartsAt: l.type === 'lend' ? p.startsAt : null,
          loanEndsAt: l.type === 'lend' ? loanEnd(p) : null
        })
        .returning({ id: agreement.id });
      // The asker's request this answers closes with the agreement (003 FR-016).
      const settled = p.requestId ? await closeForAgreement(tx, p.requestId, saved!.id) : null;

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
      await tx.update(proposal).set({ status: 'accepted', acceptedAt: new Date(), updatedAt: new Date() }).where(eq(proposal.id, p.id));

      // Nothing left: every other open proposal on it closes (FR-019).
      const [after] = await tx.select({ status: offering.status, closedReason: offering.closedReason }).from(offering).where(eq(offering.id, l.id));
      let closedOthers: string[] = [];
      if (after?.status === 'closed' && after.closedReason === 'used_up') {
        const closed = await tx
          .update(proposal)
          .set({ status: 'closed', closedReason: 'nothing_left', updatedAt: new Date() })
          .where(and(eq(proposal.offeringId, l.id), eq(proposal.status, 'open'), ne(proposal.id, p.id)))
          .returning({ id: proposal.id });
        closedOthers = closed.map((c) => c.id);
      }
      return { agreementId: saved!.id, closedOthers, settled };
    });
  } catch (err) {
    // PostgreSQL's exclusion constraint: another loan was accepted for overlapping dates meanwhile.
    if ((err as { code?: string }).code === '23P01' || (err as { cause?: { code?: string } }).cause?.code === '23P01') {
      throw new ApiError(409, 'dates_taken', 'Those dates were just taken by another loan. Please ask for other dates.');
    }
    if (err instanceof ApiError && err.code === 'proposal_changed') {
      throw new ApiError(409, err.code, err.message, undefined, { proposal: await getProposal(proposalId, listerId) });
    }
    throw err;
  }

  await afterAccept(proposalId, listerId, result);
  if (result.settled) await announceSettled(result.settled, listerId);
  return { agreementId: result.agreementId };
}

/** Notes and notices once an acceptance is saved: the requester, and others it affects. */
async function afterAccept(proposalId: string, listerId: string, result: { agreementId: string; closedOthers: string[] }) {
  const p = await loadProposal(proposalId);
  const ctx = await offeringContext(p.offeringId);
  const l = ctx.offering;
  const lister = await nameOf(listerId);
  await postEvent(await threadOf(proposalId), listerId, { kind: 'accepted', body: `${lister} accepted this proposal. It's now an agreement.` });
  await notify(p.requesterId, 'agreement', {
    title: `${lister} accepted your proposal for ${l.title}`,
    body: 'You can see what was agreed in wunan.',
    url: `/agreements/${result.agreementId}`
  });

  const goneWords = { lend: 'is no longer available', gift: 'has all been given away', trade: 'has all been traded', service: 'has no times left' } as const;
  for (const id of result.closedOthers) {
    const other = await loadProposal(id);
    await postEvent(
      await threadOf(id),
      null,
      { kind: 'closed', body: `This proposal was closed because ${l.title} ${goneWords[l.type]}. Nobody did anything wrong.` },
      { title: `${l.title} ${goneWords[l.type]}`, body: 'Your proposal for it was closed.', to: [other.requesterId] }
    );
  }

  // Others still open that no longer fit: less is left than they ask for, or the dates are taken.
  const stillOpen = await db.select().from(proposal).where(and(eq(proposal.offeringId, l.id), eq(proposal.status, 'open')));
  for (const other of stillOpen) {
    const { issues } = proposalIssues(other, await offersOf(other.id), ctx);
    const affected = issues.find((i) => (i.field === 'amount' && i.message.startsWith('Only')) || i.field === 'sessions' || (i.field === 'date' && i.message.includes('already lent')));
    if (!affected) continue;
    await notify(other.requesterId, 'message', {
      title: l.type === 'lend' ? `Someone is borrowing the ${l.title} on those dates` : `Less of the ${l.title} is left than you asked for`,
      body: `${affected.message} You can change your proposal.`,
      url: `/proposals/${other.id}`,
      conversationId: await threadOf(other.id)
    });
  }
}

function offerSnapshot(p: ProposalRow, offers: OfferRow[], accepts: AcceptRow[]): AgreementOfferSnapshot {
  return {
    items: offers.map((o) => {
      const thing = accepts.find((a) => a.id === o.tradeAcceptId)!;
      return { description: thing.description, amount: trimDecimal(o.amount ?? thing.amount), unit: thing.unit };
    }),
    own: p.ownOffer ? { description: p.ownOffer, amount: trimDecimal(p.ownOfferAmount), unit: p.ownOfferUnit } : null
  };
}

export async function declineProposal(proposalId: string, listerId: string, note: string | null) {
  const p = await loadProposal(proposalId);
  const ctx = await offeringContext(p.offeringId);
  if (ctx.offering.ownerId !== listerId) {
    if (p.requesterId === listerId) throw new ApiError(403, 'not_lister', 'You can withdraw your proposal instead.');
    throw errors.notFound('That proposal');
  }
  await endProposal(p, 'declined', note);
  const name = await nameOf(listerId);
  await postEvent(
    await threadOf(proposalId),
    listerId,
    { kind: 'declined', body: `${name} declined this proposal.${note ? ` Their note: ${note}` : ''}` },
    { title: `${name} declined your proposal for ${ctx.offering.title}`, body: note ?? 'You can still look at it in wunan.' }
  );
  return getProposal(proposalId, listerId);
}

export async function withdrawProposal(proposalId: string, requesterId: string, note: string | null) {
  const p = await loadProposal(proposalId);
  const ctx = await offeringContext(p.offeringId);
  if (p.requesterId !== requesterId) {
    if (ctx.offering.ownerId === requesterId) throw new ApiError(403, 'not_requester', 'You can decline this proposal instead.');
    throw errors.notFound('That proposal');
  }
  await endProposal(p, 'withdrawn', note);
  const name = await nameOf(requesterId);
  await postEvent(
    await threadOf(proposalId),
    requesterId,
    { kind: 'withdrawn', body: `${name} withdrew this proposal.${note ? ` Their note: ${note}` : ''}` },
    { title: `${name} withdrew their proposal for ${ctx.offering.title}`, body: note ?? 'Nothing else changes.' }
  );
  return getProposal(proposalId, requesterId);
}

async function endProposal(p: ProposalRow, status: 'declined' | 'withdrawn', note: string | null) {
  const ended = await db
    .update(proposal)
    .set({ status, decisionNote: note, updatedAt: new Date() })
    .where(and(eq(proposal.id, p.id), eq(proposal.status, 'open')))
    .returning({ id: proposal.id });
  if (ended.length === 0) throw new ApiError(409, 'proposal_ended', 'This proposal has already ended.');
}

/**
 * Closes open proposals for a reason nobody chose: a quiet month (FR-020a) or a member leaving.
 * Writes a note in each thread and tells the members still here.
 */
export async function closeProposals(ids: string[], reason: 'quiet' | 'member_left') {
  for (const id of ids) {
    const [closed] = await db
      .update(proposal)
      .set({ status: 'closed', closedReason: reason, updatedAt: new Date() })
      .where(and(eq(proposal.id, id), eq(proposal.status, 'open')))
      .returning();
    if (!closed) continue;
    const ctx = await offeringContext(closed.offeringId);
    const words =
      reason === 'quiet'
        ? { body: 'This proposal was closed after a quiet month. You can make a new one any time.', title: `Your proposal for ${ctx.offering.title} was closed after a quiet month` }
        : { body: 'This proposal was closed because one of you left wunan.', title: `A proposal for ${ctx.offering.title} was closed` };
    await postEvent(await threadOf(id), null, { kind: 'closed', body: words.body }, { title: words.title });
  }
}

/** Open proposals with no message or change for 30 days close by themselves (FR-020a). */
export async function closeQuietProposals(now = new Date()) {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const quiet = await db.select({ id: proposal.id }).from(proposal).where(and(eq(proposal.status, 'open'), lt(proposal.lastActivityAt, cutoff)));
  await closeProposals(quiet.map((q) => q.id), 'quiet');
  return { closed: quiet.length };
}

// ── Reading ────────────────────────────────────────────────────────────────────────────────────

async function loadProposal(proposalId: string) {
  const [row] = await db.select().from(proposal).where(eq(proposal.id, proposalId));
  if (!row) throw errors.notFound('That proposal');
  return row;
}

async function threadOf(proposalId: string) {
  const [row] = await db.select({ id: conversation.id }).from(conversation).where(eq(conversation.proposalId, proposalId));
  return row!.id;
}

async function nameOf(memberId: string) {
  const [row] = await db.select().from(member).where(eq(member.id, memberId));
  return row ? shownName(row) : 'A member';
}

/** One proposal for its requester or lister, with its details, issues, and what they may do. */
export async function getProposal(proposalId: string, memberId: string) {
  const p = await loadProposal(proposalId);
  const ctx = await offeringContext(p.offeringId);
  const l = ctx.offering;
  const isLister = l.ownerId === memberId;
  if (!isLister && p.requesterId !== memberId) throw errors.notFound('That proposal');
  const offers = await offersOf(p.id);
  const { issues, areaUnchecked } = p.status === 'open' ? proposalIssues(p, offers, ctx) : { issues: [], areaUnchecked: false };
  const [requester] = await db.select().from(member).where(eq(member.id, p.requesterId));
  const [made] = await db.select({ id: agreement.id }).from(agreement).where(eq(agreement.proposalId, p.id));
  const local = p.startsAt ? instantToLocal(p.startsAt) : null;
  const place = resolvedPlace(p, l);
  const showsLoan = l.type === 'lend' && p.startsAt && (p.status === 'open' || p.status === 'accepted');
  const earlierLoan = showsLoan ? await earlierLoanNotBack(l.id, p.startsAt!, made?.id) : null;

  return {
    id: p.id,
    status: p.status,
    closedReason: p.closedReason,
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
      // The offering's own place shows only its display until accepted (or to the lister).
      place: viewPlace(place, { full: !placeFromOffering(p) || isLister || p.status === 'accepted' }),
      loanLength: p.loanLength,
      loanLengthUnit: p.loanLengthUnit,
      amount: trimDecimal(p.amount),
      offers: offers.map((o) => {
        const thing = ctx.accepts.find((a) => a.id === o.tradeAcceptId)!;
        return { acceptId: thing.id, description: thing.description, amount: trimDecimal(o.amount), unit: thing.unit };
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
    earlierLoanNotBack: earlierLoan,
    canAccept: isLister && p.status === 'open' && issues.length === 0,
    canEdit: !isLister && p.status === 'open',
    myRole: isLister ? ('lister' as const) : ('requester' as const),
    conversationId: await threadOf(p.id),
    agreementId: made?.id ?? null,
    decisionNote: p.decisionNote,
    createdAt: p.createdAt.toISOString(),
    lastActivityAt: p.lastActivityAt.toISOString()
  };
}

/** The request a proposal answers, for "For your request: …" (003). */
async function requestOf(requestId: string | null) {
  if (!requestId) return null;
  const [row] = await db.select({ id: request.id, title: request.title, status: request.status }).from(request).where(eq(request.id, requestId));
  return row ?? null;
}

/** Proposals I made and received (FR-024), open first, then latest activity first. */
export async function listProposals(memberId: string, query: { role?: 'requester' | 'lister' | undefined; status?: 'open' | 'ended' | undefined; cursor?: string | undefined; limit: number }) {
  const mine = query.role === 'requester' ? eq(proposal.requesterId, memberId) : query.role === 'lister' ? eq(offering.ownerId, memberId) : or(eq(proposal.requesterId, memberId), eq(offering.ownerId, memberId));
  const status = query.status === 'open' ? eq(proposal.status, 'open') : query.status === 'ended' ? ne(proposal.status, 'open') : undefined;
  const offset = Math.max(0, Number(query.cursor ?? 0) || 0);
  const rows = await db
    .select({ proposal, offering })
    .from(proposal)
    .innerJoin(offering, eq(offering.id, proposal.offeringId))
    .where(and(mine, status))
    .orderBy(sql`case when ${proposal.status} = 'open' then 0 else 1 end`, desc(proposal.lastActivityAt), desc(proposal.id))
    .offset(offset)
    .limit(query.limit + 1);
  const page = rows.slice(0, query.limit);
  const items = [];
  for (const { proposal: p, offering: l } of page) {
    const isLister = l.ownerId === memberId;
    const ctx = await offeringContext(l.id);
    const { issues } = p.status === 'open' ? proposalIssues(p, await offersOf(p.id), ctx) : { issues: [] };
    const threadId = await threadOf(p.id);
    const [read] = await db
      .select({ lastReadAt: conversationParticipant.lastReadAt })
      .from(conversationParticipant)
      .where(and(eq(conversationParticipant.conversationId, threadId), eq(conversationParticipant.memberId, memberId)));
    const [last] = await db.select().from(message).where(eq(message.conversationId, threadId)).orderBy(desc(message.createdAt)).limit(1);
    const unread = Boolean(last && last.authorId !== memberId && (!read?.lastReadAt || last.createdAt > read.lastReadAt));
    items.push({
      id: p.id,
      status: p.status,
      closedReason: p.closedReason,
      offering: { id: l.id, title: l.title, type: l.type },
      otherMember: { id: isLister ? p.requesterId : l.ownerId, displayName: isLister ? await nameOf(p.requesterId) : ctx.ownerName },
      myRole: isLister ? ('lister' as const) : ('requester' as const),
      issues,
      unread,
      lastActivityAt: p.lastActivityAt.toISOString(),
      lastMessagePreview: last ? (last.kind === 'text' ? last.body.slice(0, 100) : last.body.slice(0, 100) || null) : null
    });
  }
  return { items, nextCursor: rows.length > query.limit ? String(offset + query.limit) : null };
}

/** Open proposals a member made or received, for closing when they leave wunan. */
export async function openProposalsOf(memberId: string) {
  const rows = await db
    .select({ id: proposal.id })
    .from(proposal)
    .innerJoin(offering, eq(offering.id, proposal.offeringId))
    .where(and(eq(proposal.status, 'open'), or(eq(proposal.requesterId, memberId), eq(offering.ownerId, memberId))));
  return rows.map((r) => r.id);
}

setProposalCloser(async (memberId) => closeProposals(await openProposalsOf(memberId), 'member_left'));
