// Plain-language text for offerings, requests and arrangements, used everywhere they are shown
// (constitution II).
import type {
  Arrangement,
  ArrangementStage,
  Handover,
  Offering,
  OfferingType,
  PlaceView,
  RequestKind,
  TimelineStep,
  Unit
} from '@wunan/shared';

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

// ── Arrangements (004): one exchange, said in plain words ──────────────────────────────────────

const askedFor: Record<OfferingType, string> = {
  lend: 'to borrow',
  gift: 'for',
  trade: 'to trade for',
  service: 'for'
};

/** Whose ask it is, from the reader's side: "You asked to borrow" / "Rosa asked for". */
export function sideWords(
  type: OfferingType,
  myRole: 'requester' | 'lister' | 'helper',
  requesterName: string
): string {
  return `${myRole === 'requester' ? 'You' : requesterName} asked ${askedFor[type]}`;
}

/** The list's headings, in order. */
export const groupHeadings = [
  { key: 'needsYou', heading: 'Waiting on you' },
  { key: 'inProgress', heading: 'In progress' },
  { key: 'finished', heading: 'Finished' }
] as const;

/** The short label shown as a badge beside the stage's sentence. */
export const stageLabels: Record<ArrangementStage, string> = {
  arranging: 'Being arranged',
  agreed: 'Agreed',
  on_loan: 'On loan',
  returned: 'Returned',
  done: 'Done',
  ended: 'Ended'
};

const detailWords: Record<string, string> = {
  date: 'when',
  handover: 'how',
  place: 'where',
  loanLength: 'how long',
  amount: 'how much',
  offers: 'what in return',
  ownOffer: 'what in return',
  sessionLength: 'how long',
  sessions: 'how many times'
};

/** What `stageWords` needs; both the list's summaries and the full arrangement can give it. */
export type StageInfo = {
  stage: ArrangementStage;
  status: 'open' | 'agreed' | 'declined' | 'withdrawn' | 'closed';
  closedReason: 'nothing_left' | 'quiet' | 'member_left' | null;
  issues: { field: string }[];
  myRole: 'requester' | 'lister' | 'helper';
  /** The lister's name, for "Waiting for …" when I'm the requester. */
  listerName: string;
  startsAt: string | null;
  hasTime: boolean;
  loanEndsAt: string | null;
  overdue: boolean;
  returnedAt: string | null;
  doneAt: string | null;
};

/**
 * Where an arrangement stands, as one calm line: "Needs details: when, how", "Waiting for Fay",
 * "Agreed for Sat 14 Nov, 10 am", "Due back Sat 14 Nov", "It was due back …" (never "late" or
 * "overdue"), "Returned on …", "Done on …", or how it ended.
 */
export function stageWords(a: StageInfo): string {
  switch (a.stage) {
    case 'arranging': {
      if (a.issues.length === 0)
        return a.myRole === 'lister' ? 'Ready for you to accept' : `Waiting for ${a.listerName}`;
      const missing = [
        ...new Set(a.issues.map((issue) => detailWords[issue.field]).filter(Boolean))
      ];
      return missing.length ? `Needs details: ${missing.join(', ')}` : 'Needs a change';
    }
    case 'agreed':
      return a.startsAt
        ? `Agreed for ${a.hasTime ? when(a.startsAt) : shortDay(a.startsAt)}`
        : 'Agreed';
    case 'on_loan':
      if (!a.loanEndsAt) return 'On loan';
      return a.overdue ? `It was due back ${when(a.loanEndsAt)}` : `Due back ${when(a.loanEndsAt)}`;
    case 'returned':
      return a.returnedAt ? `Returned on ${shortDay(a.returnedAt)}` : 'Returned';
    case 'done':
      return a.doneAt ? `Done on ${shortDay(a.doneAt)}` : 'Done';
    case 'ended':
      if (a.status === 'declined') return 'Declined';
      if (a.status === 'withdrawn') return 'Withdrawn';
      return a.closedReason === 'nothing_left'
        ? 'Closed: nothing left'
        : a.closedReason === 'member_left'
          ? 'Closed: one of you left wunan'
          : 'Closed after a quiet month';
  }
}

/** A timeline step in a word or two. */
export const stepWords: Record<TimelineStep['step'], string> = {
  asked: 'Asked',
  details_changed: 'Details changed',
  agreed: 'Agreed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  closed: 'Closed',
  lent: 'Lent from',
  due_back: 'Due back',
  returned: 'Returned',
  done: 'Done',
  help_asked: 'Help asked for',
  help_outcome: 'Help settled'
};

/** One plain sentence about what was agreed, from the reader's side: "You gave Alex 2 kg of Rice." */
export function agreedSentence(
  a: Pick<Arrangement, 'offering' | 'lister' | 'requester' | 'details' | 'agreed' | 'myRole'>
): string {
  const owner = a.myRole === 'lister' ? 'You' : a.lister.displayName;
  const other = a.myRole === 'requester' ? 'you' : a.requester.displayName;
  const { title, unit, type } = a.offering;
  const what = a.details.amount ? `${quantity(a.details.amount, unit)} of ${title}` : title;
  switch (type) {
    case 'lend':
      return `${owner} lent ${other} ${title}${a.agreed?.loanEndsAt ? `, back by ${when(a.agreed.loanEndsAt)}` : ''}.`;
    case 'gift':
      return `${owner} gave ${other} ${what}.`;
    case 'trade':
      return `${owner} traded ${what} with ${other}.`;
    case 'service': {
      const times = a.details.sessions ?? 1;
      return `${owner} provided ${times} ${times === 1 ? 'session' : 'sessions'} of ${title} for ${other}.`;
    }
  }
}
