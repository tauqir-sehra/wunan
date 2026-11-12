// What stops a lister from accepting an arrangement yet, in plain words (002 data-model "Issues"),
// and the small pure helpers the rules share. Worked out each time from the arrangement and the
// offering as they are now, never stored, so an offering edit never leaves a stale flag behind.
// No database access here: modules/arrangements.ts loads the `OfferingContext` and calls in.
import type { ArrangementIssue, Place } from '@wunan/shared';
import { timesText } from '@wunan/shared';
import type { arrangement, offering, serviceAvailability, tradeAccept } from '../db/schema/index.ts';
import { addLength, describeWhen, instantToLocal, lengthInMinutes, localWeekday } from '../lib/time.ts';
import { trimDecimal, type unreturnedLoans } from './offerings.ts';
import { displayOf, sameArea } from './places.ts';

export type ArrangementRow = typeof arrangement.$inferSelect;
export type OfferingRow = typeof offering.$inferSelect;
export type AcceptRow = typeof tradeAccept.$inferSelect;
export type TimeRow = typeof serviceAvailability.$inferSelect;
export type Loan = Awaited<ReturnType<typeof unreturnedLoans>>[number];
export type OfferRow = { tradeAcceptId: string; amount: string | null };

/** Everything about an offering that decides whether an arrangement fits it. */
export type OfferingContext = { offering: OfferingRow; ownerName: string; accepts: AcceptRow[]; times: TimeRow[]; loans: Loan[] };

// ── Words ──────────────────────────────────────────────────────────────────────────────────────

export const whenWord = { lend: 'pickup time', gift: 'pickup time', trade: 'time to trade', service: 'time' } as const;

/** How the handover happens, in words for this type (research §6). */
export function handoverWords(type: OfferingRow['type'], handover: NonNullable<ArrangementRow['handover']>, names: { lister: string; requester: string }) {
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
export const length = (n: number, unit: string) => `${n} ${unitWords[unit]![n === 1 ? 0 : 1]}`;
export const quantity = (amount: string, unit: string | null) => (unit && unit !== 'item' ? `${trimDecimal(amount)} ${unit}` : trimDecimal(amount)!);

export const describeTimes = timesText;

// ── Places and dates ───────────────────────────────────────────────────────────────────────────

/** The place an arrangement happens at: its own, or the offering's area or meeting place (research §6). */
export function resolvedPlace(p: ArrangementRow, l: OfferingRow): Place | null {
  if (p.handover === 'online') return null;
  if (p.handover === 'at_lister') return l.area;
  if (p.handover === 'elsewhere') return p.place ?? l.meetingPlace;
  return p.place;
}
/** Whether the place shown comes from the offering, so only its display is shown until accepted. */
export const placeFromOffering = (p: ArrangementRow) => p.handover === 'at_lister' || (p.handover === 'elsewhere' && !p.place);

export const loanEnd = (p: ArrangementRow) => (p.startsAt && p.loanLength && p.loanLengthUnit ? addLength(p.startsAt, p.loanLength, p.loanLengthUnit) : null);

// ── Issues ─────────────────────────────────────────────────────────────────────────────────────

/**
 * What stops the lister from accepting, in plain words (data-model "Issues"). An empty list means
 * it can be accepted. `areaUnchecked` is true when wunan couldn't compare a typed place with the
 * offering's area, so the lister decides.
 */
export function arrangementIssues(p: ArrangementRow, offers: OfferRow[], ctx: OfferingContext, now = new Date()) {
  const l = ctx.offering;
  const issues: ArrangementIssue[] = [];
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
function fitsTimes(p: ArrangementRow, times: TimeRow[]) {
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
