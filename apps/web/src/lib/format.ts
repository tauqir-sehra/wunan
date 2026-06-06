// Plain-language text for listings, used everywhere a listing is shown (constitution II).
import type { Handover, Listing, ListingType, PlaceView, Unit } from '@wunan/shared';

export const typeLabels: Record<ListingType, string> = { lend: 'Lend', gift: 'Gift', trade: 'Trade', service: 'Service' };
export const typeHints: Record<ListingType, string> = {
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
export const unitLabel = (unit: Unit) => (unit === 'other' ? 'other (say in the description)' : unitNames[unit][1]);

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
export const duration = (length: number, unit: string) => `${length} ${durations[unit]?.[length === 1 ? 0 : 1] ?? unit}`;

/** The main line under a listing's title: how much, how long, how many sessions. */
export function amountLine(listing: Listing): string | null {
  switch (listing.type) {
    case 'gift':
    case 'trade':
      if (!listing.amount) return null;
      return listing.remaining !== null && listing.remaining !== listing.amount
        ? `${quantity(listing.remaining, listing.unit)} left`
        : `${quantity(listing.amount, listing.unit)} available`;
    case 'lend':
      return listing.loanLength && listing.loanLengthUnit
        ? `Lend for up to ${duration(listing.loanLength, listing.loanLengthUnit)}`
        : 'Loan length to be agreed';
    case 'service': {
      const parts = [];
      if (listing.sessionLength && listing.sessionLengthUnit) parts.push(duration(listing.sessionLength, listing.sessionLengthUnit));
      if (listing.sessionsRemaining !== null) {
        parts.push(`${listing.sessionsRemaining} ${listing.sessionsRemaining === 1 ? 'session' : 'sessions'} available`);
      }
      return parts.length ? parts.join(' · ') : null;
    }
  }
}

/** For trades: what the owner accepts in return, or that they're open to offers (002 FR-006). */
export function acceptsLine(listing: Pick<Listing, 'type' | 'accepts' | 'owner'>): string | null {
  if (listing.type !== 'trade') return null;
  if (listing.accepts.length === 0) return `Open to offers: ${listing.owner.displayName} hasn't listed anything specific`;
  return `Accepts: ${listing.accepts.map((a) => (a.amount ? `${a.description} (${quantity(a.amount, a.unit)})` : a.description)).join(', ')}`;
}

export const statusText: Record<Listing['status'], string> = {
  available: 'Available',
  paused: 'Paused',
  closed: 'Closed'
};

/** "Lent out until Tue 10 Nov" or the status in words. */
export function listingStatus(listing: Pick<Listing, 'status' | 'lentOut' | 'takenPeriods'>): string {
  if (listing.status === 'available' && listing.lentOut) {
    const now = listing.takenPeriods.find((p) => new Date(p.startsAt) <= new Date());
    return now ? `Lent out until ${shortDay(now.endsAt)}` : 'Lent out';
  }
  return statusText[listing.status];
}

/** How the handover happens, in words for the type (002 research §6). */
export function handoverText(type: ListingType, handover: Handover, names: { lister: string; requester: string }): string {
  const goods = type === 'lend' || type === 'gift';
  const place = (name: string) => (name === 'you' ? 'your place' : name === 'me' ? 'my place' : `${name}'s`);
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

/** The question a listing form asks about the handover. */
export const handoverQuestion: Record<ListingType, string> = {
  lend: 'How the pickup happens',
  gift: 'How the pickup happens',
  trade: 'How the trade happens',
  service: 'How the service happens'
};

export const handoverValues: Handover[] = ['to_requester', 'at_lister', 'elsewhere', 'online'];

export const dayNames = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Monday–Friday, 18:00–21:00; Saturday, 10:00–12:00": consecutive days with the same hours grouped. */
export function timesText(times: { weekday: number; startTime: string; endTime: string }[]): string {
  const byHours = new Map<string, number[]>();
  for (const t of times) byHours.set(`${t.startTime}–${t.endTime}`, [...(byHours.get(`${t.startTime}–${t.endTime}`) ?? []), t.weekday]);
  const parts: string[] = [];
  for (const [hours, days] of byHours) {
    const sorted = [...new Set(days)].sort((a, b) => a - b);
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

/** What may be shown of a place: in full for those allowed, otherwise neighbourhood and city. */
export const placeText = (place: PlaceView | null | undefined) => (place ? ('label' in place ? place.label : place.display) : null);

/** "Tue 10 Nov" for an ISO time. */
export function shortDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** "8–11 Nov" style range for lend periods already taken. */
export function periodText(startsAt: string, endsAt: string): string {
  return `${shortDay(startsAt)} to ${shortDay(endsAt)}`;
}

/** A calm, readable time: "Sat 7 Nov, 14:30". Uses the server's time zone (set TZ for the community). */
export function when(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "Sat 10 January" for a YYYY-MM-DD date. */
export function day(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' });
}

type AgreementLike = {
  outcome: 'lent' | 'gifted' | 'traded' | 'provided';
  amount: string | null;
  sessions: number | null;
  loanEndsAt: string | null;
  listing: { title: string; unit: Unit | null };
  owner: { displayName: string };
  otherMember: { displayName: string };
  myRole: 'owner' | 'other' | 'mediator';
};

/** One plain sentence from the reader's side: "You gave Alex 2 kg of Rice." */
export function agreementSentence(a: AgreementLike): string {
  const owner = a.myRole === 'owner' ? 'You' : a.owner.displayName;
  const other = a.myRole === 'other' ? 'you' : a.otherMember.displayName;
  const what = a.amount ? `${quantity(a.amount, a.listing.unit)} of ${a.listing.title}` : a.listing.title;
  switch (a.outcome) {
    case 'lent':
      return `${owner} lent ${other} ${a.listing.title}${a.loanEndsAt ? `, back by ${when(a.loanEndsAt)}` : ''}.`;
    case 'gifted':
      return `${owner} gave ${other} ${what}.`;
    case 'traded':
      return `${owner} traded ${what} with ${other}.`;
    case 'provided':
      return `${owner} provided ${a.sessions ?? 1} ${a.sessions === 1 || !a.sessions ? 'session' : 'sessions'} of ${a.listing.title} for ${other}.`;
  }
}
