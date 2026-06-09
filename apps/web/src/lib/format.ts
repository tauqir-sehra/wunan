// Plain-language text for offerings, used everywhere an offering is shown (constitution II).
import type { Handover, Offering, OfferingType, PlaceView, RequestKind, Unit } from '@wunan/shared';

export const typeLabels: Record<OfferingType, string> = {
  lend: 'Lend',
  gift: 'Gift',
  trade: 'Trade',
  service: 'Service'
};
/** Words for helping with a request by offering type: "Lend with a new offering", "You haven't listed anything to lend". */
export const helpWords: Record<OfferingType, { withNew: string; listed: string; none: string }> = {
  lend: {
    withNew: 'Lend with a new offering.',
    listed: 'What you’ve listed to lend',
    none: 'You haven’t listed anything to lend.'
  },
  gift: {
    withNew: 'Give with a new offering.',
    listed: 'What you’ve listed to give away',
    none: 'You haven’t listed anything to give away.'
  },
  trade: {
    withNew: 'Trade with a new offering.',
    listed: 'What you’ve listed to trade',
    none: 'You haven’t listed anything to trade.'
  },
  service: {
    withNew: 'Offer your help with a new offering.',
    listed: 'The services you’ve listed',
    none: 'You haven’t listed a service to offer.'
  }
};
export const typeHints: Record<OfferingType, string> = {
  lend: 'Something you lend out and get back, like a drill or a tent.',
  gift: 'Something you give away, like leftover food or clothes.',
  trade: 'Something you swap for something else, or for money you agree on.',
  service: 'Time and skills you offer, like a haircut or help moving.'
};

const unitNames: Record<Unit, [string, string]> = {
  item: ['item', 'items'],
  kg: ['kg', 'kg'],
  g: ['g', 'g'],
  lb: ['lb', 'lb'],
  oz: ['oz', 'oz'],
  litre: ['litre', 'litres'],
  hour: ['hour', 'hours'],
  portion: ['portion', 'portions'],
  bag: ['bag', 'bags'],
  box: ['box', 'boxes'],
  other: ['', '']
};
export const unitOptions = Object.keys(unitNames) as Unit[];
export const unitLabel = (unit: Unit) =>
  unit === 'other' ? 'other (say in the description)' : unitNames[unit][1];

/** "5 kg", "1 item", "3 bags", "2.5 litres". */
export function quantity(amount: string | number, unit: Unit | null): string {
  const value = String(amount);
  if (!unit || unit === 'other') return value;
  const [one, many] = unitNames[unit];
  return `${value} ${Number(value) === 1 ? one : many}`;
}

const durations: Record<string, [string, string]> = {
  minutes: ['minute', 'minutes'],
  hours: ['hour', 'hours'],
  days: ['day', 'days'],
  weeks: ['week', 'weeks']
};
export const duration = (length: number, unit: string) =>
  `${length} ${durations[unit]?.[length === 1 ? 0 : 1] ?? unit}`;

/** The main line under an offering's title: how much, how long, how many sessions. */
export function amountLine(offering: Offering): string | null {
  switch (offering.type) {
    case 'gift':
    case 'trade':
      if (!offering.amount) return null;
      return offering.remaining !== null && offering.remaining !== offering.amount
        ? `${quantity(offering.remaining, offering.unit)} left`
        : `${quantity(offering.amount, offering.unit)} available`;
    case 'lend':
      return offering.loanLength && offering.loanLengthUnit
        ? `Lend for up to ${duration(offering.loanLength, offering.loanLengthUnit)}`
        : 'Loan length to be agreed';
    case 'service': {
      const parts = [];
      if (offering.sessionLength && offering.sessionLengthUnit)
        parts.push(duration(offering.sessionLength, offering.sessionLengthUnit));
      if (offering.sessionsRemaining !== null) {
        parts.push(
          `${offering.sessionsRemaining} ${offering.sessionsRemaining === 1 ? 'session' : 'sessions'} available`
        );
      }
      return parts.length ? parts.join(' · ') : null;
    }
  }
}

/** For trades: what the owner accepts in return, or that they're open to offers (002 FR-006). */
export function acceptsLine(offering: Pick<Offering, 'type' | 'accepts' | 'owner'>): string | null {
  if (offering.type !== 'trade') return null;
  if (offering.accepts.length === 0)
    return `Open to offers: ${offering.owner.displayName} hasn't listed anything specific`;
  return `Accepts: ${offering.accepts.map((a) => (a.amount ? `${a.description} (${quantity(a.amount, a.unit)})` : a.description)).join(', ')}`;
}

export const statusText: Record<Offering['status'], string> = {
  available: 'Available',
  paused: 'Paused',
  closed: 'Closed'
};

/** "Lent out until Tue 10 Nov" or the status in words. */
export function offeringStatus(
  offering: Pick<Offering, 'status' | 'lentOut' | 'takenPeriods'>
): string {
  if (offering.status === 'available' && offering.lentOut) {
    const now = offering.takenPeriods.find((p) => new Date(p.startsAt) <= new Date());
    return now ? `Lent out until ${shortDay(now.endsAt)}` : 'Lent out';
  }
  return statusText[offering.status];
}

/** How the handover happens, in words for the type (002 research §6). */
export function handoverText(
  type: OfferingType,
  handover: Handover,
  names: { lister: string; requester: string }
): string {
  const goods = type === 'lend' || type === 'gift';
  const place = (name: string) =>
    name === 'you' ? 'your place' : name === 'me' ? 'my place' : `${name}'s`;
  switch (handover) {
    case 'to_requester':
      return goods ? `Dropped off to ${names.requester}` : `At ${place(names.requester)}`;
    case 'at_lister':
      return goods ? `Picked up from ${names.lister}` : `At ${place(names.lister)}`;
    case 'elsewhere':
      return type === 'service' ? 'Somewhere else' : 'Meet somewhere else';
    case 'online':
      return 'Online';
  }
}

/** The question an offering form asks about the handover. */
export const handoverQuestion: Record<OfferingType, string> = {
  lend: 'How the pickup happens',
  gift: 'How the pickup happens',
  trade: 'How the trade happens',
  service: 'How the service happens'
};

export const handoverValues: Handover[] = ['to_requester', 'at_lister', 'elsewhere', 'online'];

export const dayNames = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

import { clock, timesText } from '@wunan/shared';
export { clock, timesText };

/** What may be shown of a place: in full for those allowed, otherwise neighbourhood and city. */
export const placeText = (place: PlaceView | null | undefined) =>
  place ? ('label' in place ? place.label : place.display) : null;

/** "Tue 10 Nov" for an ISO time. */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

/** "8–11 Nov" style range for lend periods already taken. */
export function periodText(startsAt: string, endsAt: string): string {
  return `${shortDay(startsAt)} to ${shortDay(endsAt)}`;
}

/** The time of day of an ISO time, as "2:30 pm". */
export function timeOfDay(iso: string): string {
  const d = new Date(iso);
  return clock(`${d.getHours()}:${d.getMinutes()}`);
}

/** A calm, readable time: "Sat 7 Nov, 2:30 pm". Uses the server's time zone (set TZ for the community). */
export function when(iso: string): string {
  return `${shortDay(iso)}, ${timeOfDay(iso)}`;
}

/** "Sat 10 January" for a YYYY-MM-DD date. */
export function day(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  });
}

/** "8 Nov" for a YYYY-MM-DD date. */
function dayMonth(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short'
  });
}

/** When a request is needed, in words (003 FR-002a). */
export function neededText(neededAfter: string | null, neededBy: string | null): string {
  if (neededAfter && neededBy) {
    if (neededAfter === neededBy) return `Needed on ${day(neededAfter)}`;
    return `Needed between ${dayMonth(neededAfter)} and ${dayMonth(neededBy)}`;
  }
  if (neededBy) return `Needed by ${dayMonth(neededBy)}`;
  if (neededAfter) return `Any time after ${dayMonth(neededAfter)}`;
  return 'No fixed date';
}

export const kindLabels: Record<RequestKind, string> = {
  borrow: 'Borrow',
  receive: 'Receive',
  trade: 'Trade',
  service: 'Service'
};
export const kindHints: Record<RequestKind, string> = {
  borrow: 'You want to borrow something and give it back.',
  receive: 'You want to be given something to keep.',
  trade: 'You want something and will give something back.',
  service: 'You want someone to do something for you.'
};

type AgreementLike = {
  outcome: 'lent' | 'gifted' | 'traded' | 'provided';
  amount: string | null;
  sessions: number | null;
  loanEndsAt: string | null;
  offering: { title: string; unit: Unit | null };
  owner: { displayName: string };
  otherMember: { displayName: string };
  myRole: 'owner' | 'other' | 'mediator';
};

/** One plain sentence from the reader's side: "You gave Alex 2 kg of Rice." */
export function agreementSentence(a: AgreementLike): string {
  const owner = a.myRole === 'owner' ? 'You' : a.owner.displayName;
  const other = a.myRole === 'other' ? 'you' : a.otherMember.displayName;
  const what = a.amount
    ? `${quantity(a.amount, a.offering.unit)} of ${a.offering.title}`
    : a.offering.title;
  switch (a.outcome) {
    case 'lent':
      return `${owner} lent ${other} ${a.offering.title}${a.loanEndsAt ? `, back by ${when(a.loanEndsAt)}` : ''}.`;
    case 'gifted':
      return `${owner} gave ${other} ${what}.`;
    case 'traded':
      return `${owner} traded ${what} with ${other}.`;
    case 'provided':
      return `${owner} provided ${a.sessions ?? 1} ${a.sessions === 1 || !a.sessions ? 'session' : 'sessions'} of ${a.offering.title} for ${other}.`;
  }
}
